import { InboxOutlined } from "@ant-design/icons";
import { message, Progress, UploadProps } from "antd";
import { RcFile } from "antd/lib/upload";
import { useState } from "react";
import SparkMD5 from "spark-md5";
import axios from "axios";

import "./App.css";
import Dragger from "antd/lib/upload/Dragger";
import { green } from "@ant-design/colors";
import Upload from "./Upload";
import Uploads from "./Uploads";

const App: React.FC = () => {
  const [currentCheckProgress, setCurrentCheckProgress] = useState(0);
  const [currentUploadProgress, setCurrentUploadProgress] = useState(0);
  const TOTAL_CHUNKS = 100; // 总共切成几份
  const CHUNK_SIZE = 5 * 1024 * 1024; // 每份多大
  const BASE_URL = "http://localhost:3000/api";

  const handleCustomUpload: UploadProps["customRequest"] = async (options) => {
    const { file, onProgress } = options;

    if (typeof file === "string") {
      message.info("文件格式错误");
      return;
    }
    const originFile = file as RcFile;

    // 1. 切片并校验文件返回md5值
    const fileMd5Value = await checkAndSliceFile(originFile);
    // 2. 校验文件的md5值
    const msg = await checkFileMD5(originFile.name, fileMd5Value);
    const { type = 1, fileList } = msg;

    if (type === 0) {
      message.success("文件已存在，秒传成功~");
      return;
    }
    // 3. 上传切片数据
    await uploadChunkList(file, fileMd5Value, fileList);

    // 4：通知服务器所有服务器分片已经上传完成
    const mergeMsg = await notifyServer(originFile, fileMd5Value);
    if (mergeMsg.status === "SUCCESS") {
      message.success("✨✨✨上传成功");
    } else {
      message.error("🌰上传失败");
    }
  };

  // 1. 切片并校验文件返回md5值
  const checkAndSliceFile = async (file: Blob | RcFile): Promise<string> => {
    const sliceFn = File.prototype.slice,
      chunkSize = file.size / TOTAL_CHUNKS,
      spark = new SparkMD5.ArrayBuffer(),
      fileReader = new FileReader();
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
          const result = spark.end();
          resolve(result);
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
        fileReader.readAsArrayBuffer(sliceFn.call(file, start, end));
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
    file: Blob | RcFile,
    MD5Value: string,
    fileList: string[]
  ) => {
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadList = [];

    for (let i = 0; i < chunks; i++) {
      console.log("fileList", fileList);
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
    file: RcFile | Blob,
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
  const notifyServer = async (file: RcFile, fileMD5Value: string) => {
    const url = `${BASE_URL}/merge?md5=${fileMD5Value}&fileName=${file.name}`;
    const { data } = await axios.get(url);
    return data;
  };

  const props: UploadProps = {
    customRequest: handleCustomUpload,
    showUploadList: false,
    maxCount: 1,
  };

  return (
    <div className="container">
      {/* <div className="box">
        <Dragger {...props}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击上传</p>
        </Dragger>

        <div className="progressBox">
          <div className="progress">
            <span>切片并计算md5值进度:</span>
            <Progress
              percent={currentCheckProgress}
              steps={10}
              strokeColor={green[6]}
            />
          </div>

          <div className="progress">
            <span>文件上传进度:</span>
            <Progress
              percent={currentUploadProgress}
              steps={10}
              strokeColor={green[6]}
            />
          </div>
        </div>
      </div> */}

      {/* <Upload /> */}
      <Uploads />
    </div>
  );
};

export default App;
