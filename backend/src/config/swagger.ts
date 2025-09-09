import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dump Tracker API',
      version: '1.0.0',
      description: 'ダンプトラック運行記録システム API仕様書',
      contact: {
        name: 'API Support',
        email: 'support@dumptracker.com'
      }
    },
    servers: [
      {
        url: 'http://10.1.119.244:8000',  // ポート8000に修正
        description: 'Local network server',
      },
      {
        url: 'http://localhost:8000',     // ポート8000に修正
        description: 'Development server',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT認証トークンを入力してください'
        }
      }
    }
  },
  apis: ['./src/routes/*.ts'],
};

const specs = swaggerJsdoc(options);
export { swaggerUi, specs };