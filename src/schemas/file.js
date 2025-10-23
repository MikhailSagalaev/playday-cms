const fileSchemas = {
  upload: {
    body: {
      type: 'object',
      required: ['location_id', 'field_name'],
      properties: {
        location_id: { type: 'integer', minimum: 1 },
        field_name: { 
          type: 'string', 
          enum: ['картинка', 'приз_1_картинка', 'приз_2_картинка', 'приз_3_картинка'],
          description: 'Название поля в таблице locations'
        }
      }
    }
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
};

module.exports = { fileSchemas };
