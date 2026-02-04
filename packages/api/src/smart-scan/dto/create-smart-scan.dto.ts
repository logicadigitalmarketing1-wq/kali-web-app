import { IsString, IsOptional, IsNumber, IsEnum, IsUrl, Min, Max } from 'class-validator';

export class CreateSmartScanDto {
  @IsString()
  @IsUrl({ require_protocol: false })
  target: string;

  @IsEnum(['quick', 'comprehensive', 'stealth', 'aggressive'])
  @IsOptional()
  objective?: string = 'comprehensive';

  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  maxTools?: number = 20;

  @IsString()
  @IsOptional()
  name?: string;
}