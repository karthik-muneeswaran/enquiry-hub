import { ArgsType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';

export enum PropertySortField {
  TITLE = 'TITLE',
  CREATED_AT = 'CREATED_AT',
  CACHED_AT = 'CACHED_AT',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

registerEnumType(PropertySortField, {
  name: 'PropertySortField',
  description: 'Fields available for sorting properties',
});

registerEnumType(SortDirection, {
  name: 'SortDirection',
  description: 'Sort direction (ascending or descending)',
});

@ArgsType()
export class PropertyConnectionArgs {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number = 20;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => PropertySortField, { nullable: true, defaultValue: PropertySortField.CACHED_AT })
  @IsOptional()
  @IsEnum(PropertySortField)
  sortBy?: PropertySortField = PropertySortField.CACHED_AT;

  @Field(() => SortDirection, { nullable: true, defaultValue: SortDirection.DESC })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDir?: SortDirection = SortDirection.DESC;
}
