import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Liveness probe — always returns 200 if the process is running.
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live() {
    return { status: 'alive' };
  }

  /**
   * Readiness probe — returns 200 if all dependencies are healthy,
   * or 503 with failing component details.
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'All dependencies healthy' })
  @ApiResponse({ status: 503, description: 'One or more dependencies unhealthy' })
  async ready(@Res() res: Response) {
    const result = await this.healthService.checkAll();

    if (result.status === 'healthy') {
      return res.status(HttpStatus.OK).json(result);
    }

    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(result);
  }
}
