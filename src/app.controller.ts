import { Controller, Get, Head, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get()
  @ApiExcludeEndpoint()
  getRoot() {
    return {
      status: 'ok',
      docsUrl: '/docs',
    };
  }

  @Head()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  headRoot(): void {
    // HEAD requests should succeed without a response body
  }
}
