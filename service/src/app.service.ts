import { Injectable } from '@nestjs/common';
import { join, resolve } from 'path';
import {
  stat,
  readdir,
  ensureDirSync,
  createWriteStream,
  createReadStream,
  move,
} from 'fs-extra';
import { AllFileData, CheckFileResp } from './app';
import { readdirSync, rmSync, statSync, unlinkSync } from 'fs';

// 查找文件是否存在
const isExit = (path: string): Promise<boolean> => {
  return new Promise((resolve) => {
    stat(path, (err) => {
      if (err && err.code === 'ENOENT') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

// 获得文件夹下的文件列表
const getDirList = async (path: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    readdir(path, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      // 适配mac系统 过滤掉.DS_Store文件
      if (data && data.length > 0 && data?.[0] === '.DS_Store') {
        data.splice(0, 1);
      }

      resolve(data);
    });
  });
};

// 获取文件chunks列表
const getChunkList = async (
  fileNamePath: string,
  md5Path: string,
): Promise<CheckFileResp> => {
  const isFileExit = await isExit(fileNamePath);
  let result: CheckFileResp;
  if (isFileExit) {
    // 文件存在
    result = {
      shouldUpload: false,
      uploadedList: [],
    };
  } else {
    // 文件不存在 -> 判断文件夹是否存在 -> 存在代表之前上传过但是没有完全上传
    const isFolderExit = await isExit(md5Path);
    let fileList = [];
    if (isFolderExit) {
      fileList = await getDirList(md5Path);
      result = {
        shouldUpload: true,
        uploadedList: fileList,
      };
    } else {
      result = {
        shouldUpload: true,
        uploadedList: fileList,
      };
    }
  }
  return result;
};

const pipeStream = (path, writeStream) => {
  return new Promise((resolve) => {
    const readStream = createReadStream(path);
    readStream.on('end', () => {
      unlinkSync(path);
      resolve(true);
    });
    readStream.pipe(writeStream);
  });
};

const extractExt = (fileName) =>
  fileName.slice(fileName.lastIndexOf('.'), fileName.length);

const getAllFile = (path: string) => {
  const fileInfo = [];
  const files = readdirSync(path); //需要用到同步读取
  files.forEach(walk);
  function walk(file) {
    const states = statSync(path + '/' + file);
    fileInfo.push({
      size: states.size,
      fileName: file,
    });
  }
  return fileInfo;
};

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  // 1. 检查文件是否已经上传
  async getCheckFile(
    fileName: string,
    fileMD5Value: string,
  ): Promise<CheckFileResp> {
    const UPLOAD_DIR = resolve(__dirname, '..', 'target');
    const ext = extractExt(fileName);
    const fileNamePath = join(UPLOAD_DIR, `${fileName}${ext}`);
    const md5Path = join(UPLOAD_DIR, `chunkDir_${fileMD5Value}`);
    const result = await getChunkList(fileNamePath, md5Path);
    return result;
  }

  async newUploadFile(fileHash, fileName, file, hash) {
    const UPLOAD_DIR = resolve(__dirname, '..', 'target');
    const chunkDir = resolve(UPLOAD_DIR, `chunkDir_${fileHash}`);
    ensureDirSync(chunkDir);
    move(file[0].path, resolve(chunkDir, hash));
  }

  async getMergeFile(
    fileName: string,
    size: number,
    fileHash: string,
  ): Promise<void> {
    const UPLOAD_DIR = resolve(__dirname, '..', 'target');
    const chunkDir = resolve(UPLOAD_DIR, `chunkDir_${fileHash}`);
    const filePath = resolve(UPLOAD_DIR, `${fileName}`);
    const chunkPaths = await readdir(chunkDir);
    chunkPaths.sort(
      (a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]),
    );
    console.log('chunkPaths', chunkPaths);
    await Promise.all(
      chunkPaths.map((chunkPath, index) =>
        pipeStream(
          resolve(chunkDir, chunkPath),
          createWriteStream(filePath, {
            start: index * size,
          }),
        ),
      ),
    );
    rmSync(chunkDir, { recursive: true });
  }

  async getAllFile() {
    const UPLOAD_DIR = resolve(__dirname, '..', 'target');
    const fileInfo = getAllFile(UPLOAD_DIR);

    const fileDetailInfo = fileInfo?.map((item, index) => {
      return {
        ...item,
        index,
      };
    });

    return fileDetailInfo;
  }

  async downloadFile(range: string, res: any, fileName: string) {
    console.log(range);
    const UPLOAD_DIR = resolve(__dirname, '..', 'target');
    const p = resolve(UPLOAD_DIR, fileName);
    // 存在 range 请求头将返回范围请求的数据
    if (range) {
      // 获取范围请求的开始和结束位置
      let [, start, end] = range.match(/(\d*)-(\d*)/);
      let statObj;
      // 错误处理
      try {
        statObj = await stat(p);
      } catch (e) {
        return 'Not Found';
      }
      // 文件总字节数
      let total = statObj.size;
      // 处理请求头中范围参数不传的问题
      let starts = Number(start) ? parseInt(start) : 0;
      let ends = Number(end) ? parseInt(end) : total - 1;

      // 响应客户端
      res.statusCode = 206;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      return createReadStream(p, { start: starts, end: ends }).pipe(res);
    } else {
      // 没有 range 请求头时将整个文件内容返回给客户端
      createReadStream(p).pipe(res);
    }
  }
}
