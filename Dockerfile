# Production Dockerfile for SchoolBase Backend & API
FROM php:8.3-fpm-alpine

# Install system dependencies & PHP MySQL extensions
RUN apk add --no-cache \
    mysql-client \
    oniguruma-dev \
    libzip-dev \
    zip \
    unzip \
    curl \
    && docker-php-ext-install pdo pdo_mysql mysqli opcache zip

# Set working directory
WORKDIR /var/www/html

# Copy backend codebase
COPY backend/ /var/www/html/backend/

# Set permissions
RUN chown -R www-data:www-data /var/www/html/backend

EXPOSE 9000
CMD ["php-fpm"]
