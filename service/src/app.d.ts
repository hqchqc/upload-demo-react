export interface CheckQuery {
  fileName: string;
  fileMD5Value: string;
}

export interface CheckFileResp {
  status: 'SUCCESS' | 'FAIL';
  message: string;
  // 0 代表 存在完整文件
  // 1 代表 存在对应文件夹 代表文件只上传了一部分
  // 2 代表 不存在文件 代表文件从未上传
  type: 0 | 1 | 2;
  file?: {
    isExit: boolean;
    name: string;
  };
  fileList?: string[];
}

export interface RequestFile {
  total: string;
  currentIndex: number;
  md5Value: string;
}

export interface CopyResp {
  status: 'SUCCESS' | 'FAILED';
  message: string;
  data?: number;
}

export interface MergeQuery {
  fileName: string;
  md5: string;
  size: string;
}
