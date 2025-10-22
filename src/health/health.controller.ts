import { Controller, Get } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus'

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([() => this.db.pingCheck('database')])
  }

  @Get('ready')
  @HealthCheck()
  async readiness() {
    return this.health.check([() => this.db.pingCheck('database')])
  }

  @Get('live')
  @HealthCheck()
  async liveness() {
    return this.health.check([])
  }
}
