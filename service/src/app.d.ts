export interface CheckQuery {
  fileName: string;
  fileHash: string;
}

export interface CheckFileResp {
  shouldUpload: boolean;
  uploadedList: string[];
  fileList?: string[];
}

export interface RequestFile {
  hash: string;
  fileName: string;
  fileHash: string;
}

export interface MergeQuery {
  fileName: string;
  fileHash: string;
  size: number;
}

export interface AllFileData {
  index: number;
  fileName: string;
  size: number;
}
