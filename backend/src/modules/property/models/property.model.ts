import { ObjectType, Field, Int, Float, ID } from '@nestjs/graphql';

@ObjectType('Property')
export class PropertyModel {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  wpId: number;

  @Field()
  slug: string;

  @Field()
  title: string;

  @Field(() => String, { nullable: true })
  content: string | null;

  @Field(() => String, { nullable: true })
  excerpt: string | null;

  @Field(() => String, { nullable: true })
  featuredImage: string | null;

  @Field(() => String, { nullable: true })
  propertyType: string | null;

  @Field(() => Float, { nullable: true })
  price: number | null;

  @Field(() => Int, { nullable: true })
  bedrooms: number | null;

  @Field(() => Int, { nullable: true })
  bathrooms: number | null;

  @Field(() => Float, { nullable: true })
  area: number | null;

  @Field(() => String, { nullable: true })
  location: string | null;

  @Field()
  status: string;

  @Field()
  cachedAt: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
