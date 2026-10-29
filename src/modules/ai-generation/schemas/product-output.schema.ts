// A JSON object that tells Gemini exactly what fields to return
export const productOutputJsonSchema = {
  type: 'object',
  properties: {
    productName: { type: 'string', description: 'SEO-optimized product title' },
    features: {
      type: 'array',
      items: { type: 'string' },
      description: '5-8 bullet points highlighting key features',
    },
    targetAudience: { type: 'string' },
    materials: { type: 'string' },
    styleTags: { type: 'array', items: { type: 'string' } },
    keywords: { type: 'array', items: { type: 'string' } },
    description: { type: 'string', description: 'Full product description' },
    seoTitle: { type: 'string' },
  },
  required: [
    'productName', 'features', 'targetAudience', 'materials',
    'styleTags', 'keywords', 'description', 'seoTitle',
  ],
};