import { Injectable } from '@nestjs/common';
import { join, resolve } from 'path';
import {
  stat,
  readdir,
  ensureDirSync,
  rename,
  readFileSync,
  writeFileSync,
} from 'fs-extra';
import { CheckFileResp, CopyResp } from './app';
import concat from 'concat-files';

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
const getChunkList = async (fileNamePath, md5Path): Promise<CheckFileResp> => {
  const isFileExit = await isExit(fileNamePath);
  let result: CheckFileResp;

  if (isFileExit) {
    // 文件存在
    result = {
      status: 'SUCCESS',
      message: '文件已存在',
      type: 0,
      file: {
        isExit: true,
        name: fileNamePath,
      },
    };
  } else {
    // 文件不存在 -> 判断文件夹是否存在 -> 存在代表之前上传过但是没有完全上传
    const isFolderExit = await isExit(md5Path);
    let fileList = [];
    if (isFolderExit) {
      fileList = await getDirList(md5Path);
      result = {
        status: 'SUCCESS',
        message: '存在对应文件夹',
        type: 1,
        fileList,
      };
    } else {
      result = {
        status: 'SUCCESS',
        message: '文件不存在',
        type: 2,
        fileList,
      };
    }
  }
  return result;
};

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async getCheckFile(
    fileName: string,
    fileMD5Value: string,
  ): Promise<CheckFileResp> {
    const fileNamePath = join(UPLOAD_DIR, fileName);
    const md5Path = join(UPLOAD_DIR, fileMD5Value);
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

  async getMergeFile(fileName, md5): Promise<CopyResp> {
    const srcDir = join(UPLOAD_DIR, md5);
    const fileArr = await getDirList(srcDir);
    fileArr.sort((x, y) => Number(x) - Number(y));

    for (let i = 0; i < fileArr.length; i++) {
      fileArr[i] = `${srcDir}\\${fileArr[i]}`;
    }

    const output = fileArr
      .map((f) => {
        return readFileSync(f).toString();
      })
      .join(';');

    try {
      writeFileSync(join(UPLOAD_DIR, fileName), output);
      return {
        status: 'SUCCESS',
        message: '',
      };
    } catch (error) {
      return {
        status: 'FAILED',
        message: '合并文件失败',
      };
    }
  }
}
