import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Query,
  UploadedFiles,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  AllFileData,
  CheckFileResp,
  CheckQuery,
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

  @Get('/verify')
  getCheckFile(@Query() query: CheckQuery): Promise<CheckFileResp> {
    const { fileName, fileHash } = query;
    return this.appService.getCheckFile(fileName, fileHash);
  }

  @Get('/merge')
  getMergeFile(@Query() query: MergeQuery): Promise<void> {
    const { fileName, size, fileHash } = query;
    return this.appService.getMergeFile(fileName, size, fileHash);
  }

  @Get('/getFile')
  getAllFile(): Promise<AllFileData[]> {
    return this.appService.getAllFile();
  }

  @Get('/download')
  downloadFile(
    @Query() query: any,
    @Headers() headers: any,
    @Res() res: any,
  ): any {
    const { range } = headers;
    const { fileName } = query;
    return this.appService.downloadFile(range, res, fileName);
  }

  @Post('/upload')
  @UseInterceptors(AnyFilesInterceptor())
  uploadFile(
    @Body() body: RequestFile,
    @UploadedFiles() file: Array<Express.Multer.File>,
  ) {
    const { fileHash, fileName, hash } = body;
    return this.appService.newUploadFile(fileHash, fileName, file, hash);
  }
}
