import {
  ClearOutlined,
  CloudUploadOutlined,
  FolderAddOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { Button, message, Progress, Table } from "antd";
import axios, { Canceler } from "axios";
import { ChangeEvent, useState } from "react";
import { sizeFilter } from "../../utils/formatSize";
import "./Upload.css";

type totalType = {
  file: null | File;
  hash: string;
  worker: null | Worker;
};

type sourceData = {
  fileHash: string;
  index: number;
  hash: string;
  chunk: Blob;
  size: number;
  percentage: number;
};

const Uploads: React.FC = () => {
  const [totalFileInfo, setTotalFileInfo] = useState<totalType>({
    file: null,
    hash: "",
    worker: null,
  });
  const [hashPercentage, setHashPercentage] = useState(0);
  const [data, setData] = useState<sourceData[]>([]);
  const [requestList, setRequestList] = useState([]);
  const [fakeUploadPercentage, setFakeUploadPercentage] = useState(0);
  const Status = {
    wait: "wait",
    pause: "pause",
    uploading: "uploading",
  };
  const [status, setStatus] = useState(Status.wait);
  const [cancelList, setCancelList] = useState<Canceler[]>([]);
  const [tableKey, setTableKey] = useState(0);
  const CancelToken = axios.CancelToken;
  const SIZE = 10 * 1024 * 1024; // 切片大小
  const BASE_URL = "http://localhost:3001/api";

  const resetData = () => {
    requestList.forEach((xhr: XMLHttpRequest) => xhr?.abort());
    setRequestList([]);
    if (totalFileInfo.worker) {
      totalFileInfo.worker.onmessage = null;
    }
  };

  const createFileChunk = (file: File, size = SIZE) => {
    const fileChunkList = [];
    let current = 0;
    while (current < file.size) {
      fileChunkList.push({
        chunkFile: file.slice(current, current + size),
      });
      current += size;
    }
    return fileChunkList;
  };

  const calculateHash = async (
    fileChunkList: {
      chunkFile: Blob;
    }[]
  ): Promise<string> => {
    return new Promise((resolve) => {
      const worker = new Worker("/hash.js");
      worker.postMessage({ fileChunkList });
      worker.onmessage = (e) => {
        const { percentage, hash } = e.data;
        setHashPercentage(percentage.toFixed(2));
        if (hash) {
          resolve(hash);
        }
      };
      setTotalFileInfo((source) => ({
        ...source,
        worker,
      }));
    });
  };

  const createProgressHandle = (item: any, index: number) => {
    return (e: { loaded: number; total: number }) => {
      item.percentage = parseInt(String((e.loaded / e.total) * 100));
      setData((source) => {
        source[index] = item;
        return source;
      });
      setTableKey(Math.random());
    };
  };

  const uploadPercentage = () => {
    if (!totalFileInfo.file || !data.length) return 0;
    const loaded = data
      .map((item) => item.size * item.percentage)
      .reduce((acc, cur) => acc + cur);
    const percentage = parseInt((loaded / totalFileInfo.file.size).toFixed(2));
    console.log("percentage", percentage);
    setFakeUploadPercentage(percentage);
  };

  const verifyUpload = async (fileName: string, hash: string) => {
    const url = `${BASE_URL}/verify?fileName=${fileName}&fileHash=${hash}`;
    const { data } = await axios.get(url);
    return data;
  };

  const mergeRequest = async (fileHash: string) => {
    const url = `${BASE_URL}/merge?size=${SIZE}&fileName=${totalFileInfo.file?.name}&fileHash=${fileHash}`;
    await axios.get(url);
    setStatus(Status.wait);
  };

  const uploadChunks = async (
    uploadedList: string | string[],
    dataSource: sourceData[],
    fileHash: string
  ) => {
    const url = `${BASE_URL}/upload`;
    const requestList = dataSource
      .filter(({ hash }) => !uploadedList?.includes(hash))
      .map(({ chunk, hash, index }) => {
        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("hash", hash);
        formData.append("fileName", totalFileInfo.file?.name as string);
        formData.append("fileHash", fileHash);
        return { formData, index };
      })
      .map(({ formData }, index) => {
        return axios({
          method: "post",
          url,
          data: formData,
          cancelToken: new CancelToken((c) => {
            cancelList.push(c);
            setCancelList(cancelList);
          }),
          onUploadProgress: createProgressHandle(dataSource[index], index),
        }).then(() => {
          const uploadPercentage = Number(
            (((index + 1) / requestList.length) * 100).toFixed(2)
          );

          setFakeUploadPercentage((source) =>
            source > uploadPercentage ? source : uploadPercentage
          );
        });
      });
    await Promise.all(requestList);

    if (uploadedList.length + requestList.length === dataSource.length) {
      await mergeRequest(fileHash);
    }
  };

  const handleFileChange = (e: ChangeEvent<any>) => {
    const [file] = e.target.files;
    if (!file) return;
    resetData();
    setTotalFileInfo((source) => ({
      ...source,
      file,
    }));
  };

  const handleStartUpload = async () => {
    if (!totalFileInfo.file) return;

    setStatus(Status.uploading);
    // 1. 创建文件切片
    const fileChunkList = createFileChunk(totalFileInfo?.file);
    // 2. 根据切片计算hash值 (Web-worker)
    const hash = await calculateHash(fileChunkList);
    setTotalFileInfo((source) => ({
      ...source,
      hash,
    }));
    // 3. 将hash传给服务端 判断文件是否已经存在服务器中
    const { shouldUpload, uploadedList } = await verifyUpload(
      totalFileInfo.file.name,
      hash
    );
    if (!shouldUpload) {
      message.success("文件已存在 秒传成功！");
      setStatus(Status.wait);
      return;
    }
    const dataSource = fileChunkList.map(({ chunkFile }, index) => ({
      fileHash: hash,
      index,
      hash: `${hash}-${index}`,
      chunk: chunkFile,
      size: chunkFile.size,
      percentage: uploadedList.includes(index) ? 100 : 0,
    }));
    setData(dataSource);
    // 4. 若文件不存在 或只存在一部分文件则上传文件
    // 5. 所有切片上传完成后 发出合并请求 后端对文件进行合并保存
    await uploadChunks(uploadedList, dataSource, hash);
  };

  const handlePause = () => {
    setStatus(Status.pause);
    resetData();
    while (cancelList?.length > 0) {
      cancelList?.pop()!("取消请求");
    }
  };

  const handleContinue = async () => {
    if (!totalFileInfo.file) return;

    setStatus(Status.uploading);

    const { uploadedList } = await verifyUpload(
      totalFileInfo.file.name,
      totalFileInfo.hash
    );

    uploadChunks(uploadedList, data, totalFileInfo.hash);
  };

  const handleReset = () => {
    resetData();
    setTotalFileInfo({
      file: null,
      hash: "",
      worker: null,
    });
    setHashPercentage(0);
    setFakeUploadPercentage(0);
  };

  const columns = [
    {
      title: "#",
      dataIndex: "index",
      key: "index",
    },
    {
      title: "切片md5",
      dataIndex: "hash",
      key: "name",
    },
    {
      title: "大小",
      dataIndex: "size",
      key: "size",
    },
    {
      title: "是否完成",
      dataIndex: "finish",
      key: "finish",
    },
    {
      title: "进度",
      dataIndex: "percentage",
      key: "progress",
    },
  ];

  return (
    <>
      <div className="btns">
        <Button icon={<FolderAddOutlined />} className="btn-item">
          选择文件
          <input
            type="file"
            className="select-file-input"
            onChange={handleFileChange}
          />
        </Button>
        <Button
          icon={<CloudUploadOutlined />}
          className="btn-item"
          onClick={handleStartUpload}
        >
          上传
        </Button>
        <Button
          icon={<PauseCircleOutlined />}
          className="btn-item"
          onClick={handlePause}
        >
          暂停
        </Button>
        <Button
          icon={<PlayCircleOutlined />}
          className="btn-item"
          onClick={handleContinue}
        >
          继续
        </Button>
        <Button
          icon={<ClearOutlined />}
          className="btn-item"
          onClick={handleReset}
        >
          清空
        </Button>
      </div>
      <div className="file-list">
        {
          <div className="file-info">
            <div className="file-info-name">
              <span>名称: {totalFileInfo.file?.name}</span>
            </div>
            <div className="file-info-size">
              <span>
                大小:
                {totalFileInfo.file?.size
                  ? sizeFilter(totalFileInfo.file?.size)
                  : ""}
              </span>
            </div>
            <div className="file-info-progress">
              {hashPercentage === 0 && <span>准备读取文件</span>}
              {hashPercentage > 0 && fakeUploadPercentage <= 0 && (
                <span>正在读取文件</span>
              )}
              {fakeUploadPercentage > 0 && <span>正在上传文件</span>}

              {fakeUploadPercentage > 0 ? (
                <Progress
                  percent={fakeUploadPercentage}
                  status="active"
                  size="small"
                />
              ) : (
                <Progress
                  percent={hashPercentage}
                  status="active"
                  size="small"
                />
              )}
            </div>
            <div className="file-info-status">{status}</div>
          </div>
        }

        {totalFileInfo.file && (
          <div className="file-table">
            <Table
              dataSource={data}
              columns={columns}
              rowKey="index"
              key={tableKey}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default Uploads;
