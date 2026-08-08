import { AvailabilityDto } from '@call-reservation/shared-types';
import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GetAvailabilityUseCase } from '../../application/get-availability.use-case';
import { InvalidAvailabilityDateError } from '../../domain/errors/invalid-availability-date.error';
import { GetAvailabilityQueryDto } from './dto/get-availability-query.dto';

@Controller('call-requests/availability')
export class AvailabilityController {
  constructor(private readonly getAvailability: GetAvailabilityUseCase) {}

  @Get()
  async get(@Query() query: GetAvailabilityQueryDto): Promise<AvailabilityDto> {
    try {
      return await this.getAvailability.execute(query.date);
    } catch (error) {
      if (error instanceof InvalidAvailabilityDateError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
