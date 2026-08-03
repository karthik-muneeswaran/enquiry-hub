import { ObjectType, Field } from '@nestjs/graphql';
import { PropertyModel } from './property.model';

@ObjectType('PropertyEdge')
export class PropertyEdge {
  @Field(() => PropertyModel)
  node: PropertyModel;

  @Field()
  cursor: string;
}

@ObjectType('PageInfo')
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field(() => String, { nullable: true })
  endCursor: string | null;
}

@ObjectType('PropertyConnection')
export class PropertyConnection {
  @Field(() => [PropertyEdge])
  edges: PropertyEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}
