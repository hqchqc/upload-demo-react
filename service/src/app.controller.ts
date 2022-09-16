import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  CheckFileResp,
  CheckQuery,
  CopyResp,
  MergeQuery,
  RequestFile,
} from './app';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // @Get('/check/file')
  // getCheckFile(@Query() query: CheckQuery): Promise<CheckFileResp> {
  //   const { fileName, fileMD5Value } = query;
  //   return this.appService.getCheckFile(fileName, fileMD5Value);
  // }

  @Get('/verify')
  getCheckFile(@Query() query: any): Promise<CheckFileResp> {
    const { fileName, fileHash } = query;
    return this.appService.getCheckFile(fileName, fileHash);
  }

  @Get('/merge')
  // getMergeFile(@Query() query: MergeQuery): Promise<CopyResp> {
  //   const { fileName, md5 } = query;
  //   return this.appService.getMergeFile(fileName, md5);
  // }
  getMergeFile(@Query() query: any): any {
    const { fileName, size, fileHash } = query;
    console.log('fileName', fileName, size, fileHash);
    return this.appService.getMergeFile(fileName, size, fileHash);
  }

  @Post('/upload')
  @UseInterceptors(AnyFilesInterceptor())
  uploadFile(
    // @Body() body: RequestFile,
    @Body() body: any,
    @UploadedFiles() file: Array<Express.Multer.File>,
  ) {
    // const { currentIndex, md5Value } = body;
    // return this.appService.uploadFile(currentIndex, md5Value, file);
    const { fileHash, fileName, hash } = body;
    return this.appService.newUploadFile(fileHash, fileName, file, hash);
  }
}
