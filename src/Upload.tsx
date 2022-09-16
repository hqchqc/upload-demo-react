import { green } from "@ant-design/colors";
import {
  ClearOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  FolderAddOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Collapse, message, Progress, Table } from "antd";
import axios from "axios";
import { ChangeEvent, useState } from "react";
import SparkMD5 from "spark-md5";
import "./Upload.css";
import { createFileChunks } from "./utils/createFileChunk";
import { sizeFilter } from "./utils/formatSize";
import { uploadChunks } from "./utils/uploadChunks";

const Uplaod: React.FC = () => {
  const [file, setFile] = useState<File>();
  const [currentCheckProgress, setCurrentCheckProgress] = useState(0);
  const [currentUploadProgress, setCurrentUploadProgress] = useState(0);
  const [chunksData, setChunksData] = useState<Blob[]>([]);

  const TOTAL_CHUNKS = 100; // 总共切成几份
  const CHUNK_SIZE = 5 * 1024 * 1024; // 每份多大
  const BASE_URL = "http://localhost:3000/api";
  const [uploadData, setUploadData] = useState([]);

  // 选择文件
  const handleFileChange = (e: ChangeEvent<any>) => {
    const [file] = e.target.files;
    if (!file) return;
    setFile(file);
  };

  // 开始上传
  const handleStartUpload = async () => {
    // if (!file || !file.size) return message.error("请选择文件");
    // // 1. 切片并校验文件返回md5值
    // const { fileMd5Value, chunkList } = await checkAndSliceFile(file);
    // console.log("chunkList", chunkList);
    // setChunksData(chunkList);
    // // 2. 校验文件的md5值
    // const msg = await checkFileMD5(file.name, fileMd5Value);
    // const { type = 1, fileList = [] } = msg;
    // if (type === 0) {
    //   message.success("文件已存在，秒传成功~");
    //   return;
    // }
    // // 3. 上传切片数据
    // await uploadChunkList(file, fileMd5Value, fileList);
    // // 4：通知服务器所有服务器分片已经上传完成
    // const mergeMsg = await notifyServer(file, fileMd5Value);
    // if (mergeMsg.status === "SUCCESS") {
    //   message.success("✨✨✨上传成功");
    // } else {
    //   message.error("🌰上传失败");
    // }

    if (!file || !file.size) return message.error("请选择文件");

    const fileChunkList = createFileChunks(file, CHUNK_SIZE);
    const hash = await calculateHash(fileChunkList);
    const uploadData = fileChunkList.map(({ chunkFile }, index) => ({
      chunk: chunkFile,
      hash: `${file?.name}-${index}`,
    }));
    await uploadChunks(uploadData, file.name, `${BASE_URL}/upload`);
    console.log("uploadData", uploadData);
    setUploadData((source) => uploadData);
  };

  // 1. 切片并校验文件返回md5值
  const checkAndSliceFile = async (
    file: File
  ): Promise<{ fileMd5Value: string; chunkList: Blob[] }> => {
    const sliceFn = File.prototype.slice,
      chunkSize = file.size / TOTAL_CHUNKS,
      spark = new SparkMD5.ArrayBuffer(),
      fileReader = new FileReader(),
      chunkList: Blob[] = [];
    let currentPercent = 0;

    return new Promise((resolve, reject) => {
      fileReader.onload = (e) => {
        if (typeof e.target?.result !== "string" && e.target?.result) {
          currentPercent++;
          spark.append(e.target.result);
          console.log(
            `⚡读取文件并分片进度：当前 ${currentPercent}, 总数${TOTAL_CHUNKS}⚡`
          );
        }

        if (currentPercent < TOTAL_CHUNKS) {
          loadSliceFile();
        } else {
          const fileMd5Value = spark.end();

          resolve({
            fileMd5Value,
            chunkList,
          });
        }
      };

      fileReader.onerror = (err) => {
        message.error("文件读取失败啦");
        reject(err);
      };

      const loadSliceFile = () => {
        const start = chunkSize * currentCheckProgress,
          end = start + chunkSize >= file.size ? file.size : start + chunkSize;
        // 按字节读取切片之后的文件内容 返回ArrayBuffer
        const chunk = sliceFn.call(file, start, end);
        console.log("chunk", chunk);
        chunkList.push(chunk);
        fileReader.readAsArrayBuffer(chunk);
        // 记录检查切片的进度
        setCurrentCheckProgress(currentPercent + 1);
      };

      loadSliceFile();
    });
  };

  // 2. 校验文件的md5值
  const checkFileMD5 = async (fileName: string, fileMd5Value: string) => {
    const url = `${BASE_URL}/check/file?fileName=${fileName}&fileMD5Value=${fileMd5Value}`;
    const { data } = await axios.get(url);
    return data;
  };

  // 3. 上传切片数据
  const uploadChunkList = async (
    file: File,
    MD5Value: string,
    fileList: string[]
  ) => {
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadList = [];

    for (let i = 0; i < chunks; i++) {
      const isExit = fileList.indexOf(i.toString()) > -1;
      if (!isExit) {
        uploadList.push(upload(i, file, chunks, MD5Value));
      }
    }

    if (uploadList?.length) {
      await Promise.all(uploadList);
    }
  };

  const upload = async (
    index: number,
    file: File,
    chunks: number,
    md5Value: string
  ) => {
    let currentUploadPercent = 0; // 上传进度
    const end =
      (index + 1) * CHUNK_SIZE >= file.size
        ? file.size
        : (index + 1) * CHUNK_SIZE;
    const form = new FormData();
    form.append("data", file.slice(index * CHUNK_SIZE, end));
    form.append("total", chunks?.toString());
    form.append("currentIndex", index?.toString());
    form.append("md5Value", md5Value);

    const url = `${BASE_URL}/upload`;
    return axios({
      method: "post",
      url,
      data: form,
    }).then(({ data }) => {
      if (data.status === "SUCCESS") {
        currentUploadPercent++;
        const uploadPercent = Math.ceil(currentUploadPercent / chunks) * 100;
        console.log("uploadPercent", uploadPercent);
        setCurrentUploadProgress(uploadPercent);
      }
    });
  };

  // 4：通知服务器所有服务器分片已经上传完成
  const notifyServer = async (file: File, fileMD5Value: string) => {
    const url = `${BASE_URL}/merge?md5=${fileMD5Value}&fileName=${file.name}`;
    const { data } = await axios.get(url);
    return data;
  };

  const columns = [
    {
      title: "#",
      dataIndex: "index",
      key: "index",
    },
    {
      title: "切片md5",
      dataIndex: "name",
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
      dataIndex: "progress",
      key: "progress",
    },
  ];

  // const dataSource = [
  //   {
  //     key: "1",
  //     index: 1,
  //     name: "2j23j213g321kg2-0",
  //     size: "2.5M",
  //     finish: "完成",
  //     progress: 100,
  //   },
  // ];

  const dataSource = uploadData?.map((item, index) => ({
    key: index,
    index,
    name: item?.hash,
    size: item?.chunk?.size,
    progress: item?.percentage,
    finish: "完成",
  }));

  const uploadPercentage = () => {
    if (!file) return 0;
    const loaded = uploadData
      .map((item) => item.size * item.percentage)
      .reduce((acc, cur) => acc + cur);

    return parseInt((loaded / file.size).toFixed(2));
  };

  return (
    <div className="upload-container">
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
        <Button icon={<PauseCircleOutlined />} className="btn-item">
          暂停
        </Button>
        <Button icon={<PlayCircleOutlined />} className="btn-item">
          继续
        </Button>
        <Button icon={<ClearOutlined />} className="btn-item">
          清空
        </Button>
        <Button icon={<CloudDownloadOutlined />} className="btn-item">
          下载
        </Button>
      </div>
      <div className="file-list">
        {file && (
          <div className="file-info">
            <div className="file-info-name">
              <span>名称: {file?.name}</span>
            </div>
            <div className="file-info-size">
              <span>
                大小: {file?.size ? sizeFilter(file?.size as number) : ""}
              </span>
            </div>
            <div className="file-info-progress">
              <span>准备读取文件:</span>
              <Progress
                // percent={currentCheckProgress}
                percent={uploadPercentage()}
                status="active"
                size="small"
              />
            </div>
            <div className="file-info-status">待上传</div>
          </div>
        )}

        {file && (
          <div className="file-table">
            <Table
              dataSource={dataSource}
              columns={columns}
              pagination={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Uplaod;
