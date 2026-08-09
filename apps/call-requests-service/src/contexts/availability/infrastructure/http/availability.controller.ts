import { AvailabilityResponse } from '@call-reservation/shared-types';
import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GetAvailabilityUseCase } from '../../application/get-availability.use-case';
import { GetAvailabilityUseCaseHandler } from '../../application/get-availability.use-case-handler';
import { InvalidAvailabilityDateError } from '../../domain/errors/invalid-availability-date.error';
import { GetAvailabilityQueryDto } from './dto/get-availability-query.dto';

@Controller('call-requests/availability')
export class AvailabilityController {
  constructor(
    private readonly getAvailability: GetAvailabilityUseCaseHandler,
  ) {}

  @Get()
  async get(
    @Query() query: GetAvailabilityQueryDto,
  ): Promise<AvailabilityResponse> {
    try {
      return await this.getAvailability.execute(
        new GetAvailabilityUseCase(query.date),
      );
    } catch (error) {
      if (error instanceof InvalidAvailabilityDateError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
