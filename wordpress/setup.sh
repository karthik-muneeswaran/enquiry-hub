#!/bin/bash
set -e

WP="wp --path=/var/www/html"

# Use env vars with defaults
WP_ADMIN_USER="${WP_ADMIN_USER:-admin}"
WP_ADMIN_PASSWORD="${WP_ADMIN_PASSWORD:-admin123}"
WP_ADMIN_EMAIL="${WP_ADMIN_EMAIL:-admin@enquiry.dev}"
WP_SITE_URL="${WP_SITE_URL:-http://localhost:8080}"
WP_SITE_TITLE="${WP_SITE_TITLE:-Enquiry Platform Properties}"

# Wait for WordPress to be ready
echo "Waiting for WordPress to be ready..."
until $WP core is-installed 2>/dev/null; do
  $WP core install \
    --url="$WP_SITE_URL" \
    --title="$WP_SITE_TITLE" \
    --admin_user="$WP_ADMIN_USER" \
    --admin_password="$WP_ADMIN_PASSWORD" \
    --admin_email="$WP_ADMIN_EMAIL" \
    --skip-email 2>/dev/null || sleep 2
done

echo "WordPress installed."
echo "  URL:      $WP_SITE_URL/wp-admin"
echo "  User:     $WP_ADMIN_USER"
echo "  Password: $WP_ADMIN_PASSWORD"

# Install and activate WPGraphQL plugin
if ! $WP plugin is-active wp-graphql 2>/dev/null; then
  echo "Installing WPGraphQL plugin..."
  $WP plugin install wp-graphql --activate
  echo "WPGraphQL activated."
else
  echo "WPGraphQL already active."
fi

# Check if we already seeded
SEEDED=$($WP option get enquiry_properties_seeded 2>/dev/null || echo "no")

if [ "$SEEDED" != "yes" ]; then
  echo "Seeding property posts..."

  $WP post create \
    --post_type=post \
    --post_status=publish \
    --post_title="3 Bed Apartment in Sydney CBD" \
    --post_name="3-bed-apartment-sydney-cbd" \
    --post_content="<p>Beautiful 3 bedroom apartment located in the heart of Sydney CBD. Features modern finishes, city views, and access to building amenities including pool and gym.</p><p>Perfect for professionals or small families looking for inner-city living.</p>" \
    --post_excerpt="Beautiful 3 bedroom apartment in the heart of Sydney CBD with city views."

  $WP post create \
    --post_type=post \
    --post_status=publish \
    --post_title="Modern House in Bondi" \
    --post_name="modern-house-bondi" \
    --post_content="<p>Stunning modern house just minutes from Bondi Beach. Open plan living, designer kitchen, and a sun-drenched backyard perfect for entertaining.</p><p>Recently renovated with premium fixtures throughout.</p>" \
    --post_excerpt="Stunning modern house minutes from Bondi Beach with designer kitchen."

  $WP post create \
    --post_type=post \
    --post_status=publish \
    --post_title="Waterfront Penthouse at Darling Harbour" \
    --post_name="waterfront-penthouse-darling-harbour" \
    --post_content="<p>Luxury penthouse with panoramic harbour views. Features premium finishes throughout, private terrace, and 2 secure parking spaces.</p><p>Exclusive top-floor position with concierge services.</p>" \
    --post_excerpt="Luxury penthouse with panoramic harbour views and private terrace."

  $WP post create \
    --post_type=post \
    --post_status=publish \
    --post_title="Spacious Family Home on the North Shore" \
    --post_name="family-home-north-shore" \
    --post_content="<p>Large family home in a quiet tree-lined street. Features 5 bedrooms, home office, double garage, and beautifully landscaped gardens.</p><p>Walking distance to top schools and transport.</p>" \
    --post_excerpt="Large family home in quiet tree-lined street with landscaped gardens."

  $WP post create \
    --post_type=post \
    --post_status=publish \
    --post_title="Stylish Studio in Surry Hills" \
    --post_name="studio-apartment-surry-hills" \
    --post_content="<p>Cleverly designed studio apartment in trendy Surry Hills. Walking distance to cafes, restaurants, and public transport.</p><p>Ideal investment property with strong rental yield.</p>" \
    --post_excerpt="Cleverly designed studio in trendy Surry Hills, walking distance to cafes."

  $WP post create \
    --post_type=post \
    --post_status=publish \
    --post_title="Beachside Villa in Manly" \
    --post_name="beachside-villa-manly" \
    --post_content="<p>Exquisite beachside villa with direct beach access. Features include infinity pool, outdoor entertaining area, and panoramic ocean views from every room.</p><p>The ultimate coastal lifestyle property.</p>" \
    --post_excerpt="Exquisite beachside villa with direct beach access and infinity pool."

  # Set permalink structure for slug-based queries
  $WP rewrite structure '/%postname%/'
  $WP rewrite flush

  # Mark as seeded
  $WP option update enquiry_properties_seeded "yes"

  echo "Seeded 6 property posts."
else
  echo "Properties already seeded."
fi

echo "WordPress setup complete!"
