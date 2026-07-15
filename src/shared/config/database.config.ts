import { TypeOrmModuleOptions } from '@nestjs/typeorm';


export const databaseConfig = (): TypeOrmModuleOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false }, // Accept self-signed certs in dev
    // synchronize: process.env.NODE_ENV !== 'production', // Auto-sync only in dev
    // Use this whenever you have a major change in your db
    synchronize: false, // Turn off auto-sync permanently to enforce migrations workflow
    logging: process.env.NODE_ENV !== 'production',
    // Auto-load entities
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    // Production migration of entity changes
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: process.env.NODE_ENV === 'production', // Auto-run migrations in production
    migrationsTableName: 'migrations',

    extra: {
        max: 20,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
    },
    retryAttempts: 5,
    retryDelay: 3000,
});
