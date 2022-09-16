import axios from "axios";

const mergeRequest = async (fileName: string, size: number) => {
  const url = `http://localhost:3000/api/merge?fileName=${fileName}&size=${size}`;
  await axios.get(url);
};

const CHUNK_SIZE = 5 * 1024 * 1024; // 每份多大

export const uploadChunks = async (
  uploadData: { chunk: Blob; hash: string }[],
  fileName: string,
  url: string
) => {
  const requestList = uploadData
    .map(({ chunk, hash }, index) => {
      const formData = new FormData();
      formData.append("chunk", chunk);
      formData.append("hash", hash);
      formData.append("fileName", fileName);
      return { formData, index };
    })
    .map(({ formData, index }) => {
      return axios({
        method: "post",
        url,
        data: formData,
        onUploadProgress: createProgressHandler(uploadData[index]),
      });
    });
  await Promise.all(requestList);
  await mergeRequest(fileName, CHUNK_SIZE);
};

const createProgressHandler = (item: {
  chunk?: Blob;
  hash?: string;
  percentage?: any;
}) => {
  return (e: { loaded: number; total: number }) => {
    item.percentage = parseInt(String((e.loaded / e.total) * 100));
  };
};
