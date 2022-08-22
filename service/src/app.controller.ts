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

  @Get('/check/file')
  getCheckFile(@Query() query: CheckQuery): Promise<CheckFileResp> {
    const { fileName, fileMD5Value } = query;
    return this.appService.getCheckFile(fileName, fileMD5Value);
  }

  @Get('/merge')
  getMergeFile(@Query() query: MergeQuery): Promise<CopyResp> {
    const { fileName, md5 } = query;
    return this.appService.getMergeFile(fileName, md5);
  }

  @Post('/upload')
  @UseInterceptors(AnyFilesInterceptor())
  uploadFile(
    @Body() body: RequestFile,
    @UploadedFiles() file: Array<Express.Multer.File>,
  ) {
    const { currentIndex, md5Value } = body;
    return this.appService.uploadFile(currentIndex, md5Value, file);
  }
}
