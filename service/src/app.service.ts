import { Injectable } from '@nestjs/common';
import { join, resolve } from 'path';
import {
  stat,
  readdir,
  ensureDirSync,
  rename,
  openSync,
  createWriteStream,
  createReadStream,
  closeSync,
  move,
  rm,
} from 'fs-extra';
import { CheckFileResp, CopyResp } from './app';
import MultiStream = require('multistream');
import { rmdirSync, rmSync, unlinkSync } from 'fs';
import { rmdir } from 'fs/promises';
const UPLOAD_DIR = './uploadFile/uploads';

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

// 文件夹是否存在，不存在则创建
const folderIsExit = (path: string): Promise<boolean> => {
  return new Promise(async (resolve) => {
    await ensureDirSync(join(path));
    resolve(true);
  });
};

// 把文件从一个目录拷贝到别一个目录
const copyFile = (src: string, dest: string): Promise<CopyResp> => {
  return new Promise((resolve, reject) => {
    rename(src, dest, (err) => {
      let result: CopyResp;
      if (err) {
        result = {
          status: 'FAILED',
          message: '拷贝文件失败',
        };
        reject(err);
      } else {
        result = {
          status: 'SUCCESS',
          message: '拷贝文件成功',
        };
        resolve(result);
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
// const getChunkList = async (fileNamePath, md5Path): Promise<CheckFileResp> => {
const getChunkList = async (fileNamePath, md5Path): Promise<any> => {
  const isFileExit = await isExit(fileNamePath);
  let result: any;
  console.log('isFileExit', isFileExit);
  if (isFileExit) {
    // 文件存在
    result = {
      // status: 'SUCCESS',
      // message: '文件已存在',
      // type: 0,
      // file: {
      //   isExit: true,
      //   name: fileNamePath,
      // },

      shouldUpload: false,
      uploadedList: [],
    };
  } else {
    // 文件不存在 -> 判断文件夹是否存在 -> 存在代表之前上传过但是没有完全上传
    const isFolderExit = await isExit(md5Path);
    let fileList = [];
    console.log('isFolderExit', isFolderExit);
    if (isFolderExit) {
      fileList = await getDirList(md5Path);
      console.log('fileList', fileList);
      result = {
        // status: 'SUCCESS',
        // message: '存在对应文件夹',
        // type: 1,
        // fileList,
        shouldUpload: true,
        uploadedList: fileList,
      };
    } else {
      result = {
        // status: 'SUCCESS',
        // message: '文件不存在',
        // type: 2,
        // fileList,
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

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  // async getCheckFile(
  //   fileName: string,
  //   fileMD5Value: string,
  // ): Promise<CheckFileResp> {
  //   const fileNamePath = join(UPLOAD_DIR, fileName);
  //   const md5Path = join(UPLOAD_DIR, fileMD5Value);
  //   const result = await getChunkList(fileNamePath, md5Path);
  //   return result;
  // }

  async getCheckFile(fileName: string, fileMD5Value: string): Promise<any> {
    const UPLOAD_DIR = resolve(__dirname, '..', 'target');
    const ext = extractExt(fileName);
    const fileNamePath = join(UPLOAD_DIR, `${fileName}${ext}`);
    const md5Path = join(UPLOAD_DIR, `chunkDir_${fileMD5Value}`);
    console.log('md5Path', md5Path);
    const result = await getChunkList(fileNamePath, md5Path);
    return result;
  }

  async uploadFile(
    index: number,
    md5Value: string,
    file: Express.Multer.File[],
  ): Promise<CopyResp> {
    const folder = join(UPLOAD_DIR, md5Value);
    const msg = await folderIsExit(folder);
    if (msg) {
      const destFile = resolve(folder, index?.toString());
      const res = await copyFile(file?.[0]?.path, destFile);
      if (res.status === 'SUCCESS') {
        return {
          status: 'SUCCESS',
          data: index,
          message: '',
        };
      } else {
        return {
          status: 'FAILED',
          data: -1,
          message: 'Error',
        };
      }
    }
  }

  // async getMergeFile(fileName, md5): Promise<CopyResp> {
  //   const srcDir = join(UPLOAD_DIR, md5);
  //   const fileArr = await getDirList(srcDir);
  //   fileArr.sort((x, y) => Number(x) - Number(y));

  //   for (let i = 0; i < fileArr.length; i++) {
  //     fileArr[i] = `${srcDir}\\${fileArr[i]}`;
  //   }

  //   const outputPath = join(UPLOAD_DIR, fileName);
  //   const fd = openSync(outputPath, 'w+');
  //   const writeStream = createWriteStream(outputPath);
  //   const readStreamList = fileArr.map((path) => createReadStream(path));

  //   return new Promise((resolve, reject) => {
  //     const multiStream = new MultiStream(readStreamList);
  //     multiStream.pipe(writeStream);
  //     multiStream.on('end', () => {
  //       closeSync(fd);
  //       resolve({
  //         status: 'SUCCESS',
  //         message: '',
  //       });
  //     });
  //     multiStream.on('error', () => {
  //       closeSync(fd);
  //       reject({
  //         status: 'FAILED',
  //         message: '合并文件失败',
  //       });
  //     });
  //   });
  // }

  async newUploadFile(fileHash, fileName, file, hash) {
    const UPLOAD_DIR = resolve(__dirname, '..', 'target');
    const chunkDir = resolve(UPLOAD_DIR, `chunkDir_${fileHash}`);
    const filePath = resolve(UPLOAD_DIR, `${fileHash}${extractExt(fileName)}`);
    ensureDirSync(chunkDir);
    move(file[0].path, resolve(chunkDir, hash));
  }

  // async getMergeFile(fileName, size: number): Promise<any> {
  //   const UPLOAD_DIR = resolve(__dirname, '..', 'target');
  //   const filePath = resolve(UPLOAD_DIR, `${fileName}`);
  //   const chunkDir = resolve(UPLOAD_DIR, 'chunkDir' + fileName);
  //   const chunkPaths = await readdir(chunkDir);
  //   chunkPaths.sort(
  //     (a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]),
  //   );
  //   await Promise.all(
  //     chunkPaths.map((chunkPath, index) =>
  //       pipeStream(
  //         resolve(chunkDir, chunkPath),
  //         createWriteStream(filePath, {
  //           start: index * size,
  //         }),
  //       ),
  //     ),
  //   );
  //   rm(chunkDir, { recursive: true });
  // }

  async getMergeFile(fileName, size: number, fileHash: string): Promise<any> {
    const ext = extractExt(fileName);
    const UPLOAD_DIR = resolve(__dirname, '..', 'target');
    const chunkDir = resolve(UPLOAD_DIR, `chunkDir_${fileHash}`);
    const filePath = resolve(UPLOAD_DIR, `${fileName}${ext}`);
    const chunkPaths = await readdir(chunkDir);
    chunkPaths.sort(
      (a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]),
    );
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
}
