import {
  DownloadOutlined,
  PauseCircleOutlined,
  RightCircleOutlined,
} from "@ant-design/icons";
import { Button, Table } from "antd";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { sizeFilter } from "../../utils/formatSize";
import streamSaver from "streamsaver";
import "../../utils/zip-stream.js";
streamSaver.mitm = "http://localhost:5173/mitm.html";

interface DownloadProps {}

type TableSource = {
  index: number;
  fileName: string;
  size: number;
  name: Symbol;
}[];

let fileStream: any,
  writer: any,
  index: number,
  ends: number,
  chunks: number,
  size: number;
let xhrList: any[] = [];

const Download: React.FC<DownloadProps> = () => {
  const BASE_URL = "http://localhost:3001/api";
  const [records, setRecords] = useState<any>();

  const [tableSource, setTableSource] = useState<TableSource>([]);

  useEffect(() => {
    fetchTableSource();
  }, []);

  async function asyncPool(
    poolLimit: number,
    array: number[],
    iteratorFn: (arg0: any, arg1: any) => any
  ) {
    const ret = []; // 存储所有的异步任务
    const executing: Promise<any>[] = []; // 存储正在执行的异步任务
    for (const item of array) {
      // 调用iteratorFn函数创建异步任务
      const p = Promise.resolve().then(() => iteratorFn(item, array));
      ret.push(p); // 保存新的异步任务
      // 当poolLimit值小于或等于总任务个数时，进行并发控制
      if (poolLimit <= array.length) {
        // 当任务完成后，从正在执行的任务数组中移除已完成的任务
        const e: any = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e); // 保存正在执行的异步任务
        if (executing.length >= poolLimit) {
          await Promise.all(executing); // 等待较快的任务执行完成
        }
      }
    }
    return Promise.all(ret);
  }

  function getBinaryContent(
    url: string,
    start: number,
    end: number,
    i: number,
    writer: any
  ) {
    return new Promise((resolve, reject) => {
      ends = end;
      try {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.setRequestHeader("range", `bytes=${start}-${end}`); // 请求头上设置范围请求信息
        xhr.responseType = "arraybuffer"; // 设置返回的类型为arraybuffer
        xhr.onload = function () {
          writer.write(new Uint8Array(xhr.response));
          resolve({
            index: i, // 文件块的索引
            buffer: xhr.response, // 范围请求对应的数据
          });
        };
        xhr.send();
        xhrList.push(xhr);
      } catch (err: any) {
        reject(new Error(err));
      }
    });
  }

  async function download({
    url,
    chunkSize,
    poolLimit = 1,
    size,
    writer,
  }: {
    url: string;
    chunkSize: number;
    poolLimit: number;
    size: number;
    writer: any;
    fileStream: any;
  }) {
    const contentLength = size;
    // chunks代表请求次数
    chunks =
      typeof chunkSize === "number" ? Math.ceil(contentLength / chunkSize) : 1;

    const results = await asyncPool(
      poolLimit,
      [...new Array(chunks).keys()],
      (i) => {
        //  i从0开始
        index = i;
        let start = i * chunkSize;
        let end = i + 1 == chunks ? contentLength - 1 : (i + 1) * chunkSize - 1;
        return getBinaryContent(url, start, end, i, writer);
      }
    );
  }

  const handleDownload = async (record: { size: number; fileName: string }) => {
    setRecords(record);
    if (!fileStream) {
      fileStream = streamSaver.createWriteStream(record?.fileName, {
        size: record?.size, // Makes the percentage visiable in the download
      });
      console.log("fileStream", fileStream);
      writer = fileStream.getWriter();
    }

    size = record?.size;
    const msg = await download({
      url: `${BASE_URL}/download?fileName=${record?.fileName}`,
      chunkSize: 10 * 1024 * 1024,
      poolLimit: 1,
      size: record?.size,
      writer,
      fileStream,
    });
    console.log("end");
    setTimeout(() => {
      writer.close();
    }, 100);
  };

  const handlePause = () => {
    // writer.abort();
    for (let i = 0; i < xhrList?.length; i++) {
      xhrList?.[i].abort();
    }
  };

  const handleContinue = async () => {
    // handleDownload(params);

    await asyncPool(
      1,
      [...new Array(chunks - (index + 1)).keys()],
      async (i) => {
        let start = ends + 1;
        let end =
          i + 1 === chunks - (index + 1)
            ? records?.size - 1
            : (i + 1) * (10 * 1024 * 1024) - 1;
        await getBinaryContent(
          `${BASE_URL}/download?fileName=${records?.fileName}`,
          start,
          end,
          i,
          writer
        );

        setTimeout(() => {
          writer.close();
        }, 100);
      }
    );
  };

  const fetchTableSource = useCallback(async () => {
    const url = `${BASE_URL}/getFile`;
    const { data } = await axios.get(url);
    setTableSource(data || []);
  }, []);

  const columns = [
    {
      title: "文件名",
      dataIndex: "fileName",
      key: "index",
    },
    {
      title: "大小",
      dataIndex: "size",
      key: "size",
      render: (text: number) => sizeFilter(text),
    },
    {
      title: "操作",
      render: (text: any, record: any) => {
        return [
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            key="btn"
          >
            下载
          </Button>,
          <Button
            icon={<PauseCircleOutlined />}
            onClick={() => handlePause()}
            key="pause"
            style={{ marginLeft: "5px" }}
          >
            暂停
          </Button>,
          <Button
            icon={<RightCircleOutlined />}
            onClick={() => handleContinue()}
            key="continue"
            style={{ marginLeft: "5px" }}
          >
            继续
          </Button>,
        ];
      },
    },
  ];

  return <Table dataSource={tableSource} columns={columns} rowKey="index" />;
};

export default Download;
