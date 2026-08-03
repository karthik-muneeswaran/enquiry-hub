import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { PropertyModel } from './models/property.model';
import { PropertyConnection } from './models/property-connection.model';
import { PropertyConnectionArgs } from './dto/property-connection.args';
import { PropertyService } from './property.service';

@Resolver(() => PropertyModel)
export class PropertyResolver {
  constructor(private readonly propertyService: PropertyService) {}

  /**
   * Query: properties - Returns a paginated list of properties with search, sort, and cursor support.
   */
  @Query(() => PropertyConnection, {
    name: 'properties',
    description: 'Paginated property listing with search, sort, and cursor-based pagination',
  })
  async getProperties(@Args() args: PropertyConnectionArgs): Promise<PropertyConnection> {
    return this.propertyService.findProperties(args);
  }

  /**
   * Query: property - Returns a single property by slug or WordPress ID.
   */
  @Query(() => PropertyModel, {
    name: 'property',
    nullable: true,
    description: 'Get a single property by slug or WordPress database ID',
  })
  async getProperty(
    @Args('slug', { type: () => String, nullable: true }) slug?: string,
    @Args('wpId', { type: () => Int, nullable: true }) wpId?: number,
  ): Promise<PropertyModel> {
    return this.propertyService.findProperty(slug, wpId) as unknown as PropertyModel;
  }
}
