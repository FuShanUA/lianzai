import { useState } from 'react';

export const useAIState = () => {
  const [llmVendors, setLlmVendors] = useState<Record<string, any>>({});
  const [selectedLlmVendor, setSelectedLlmVendor] = useState('vertex');
  const [selectedLlmModel, setSelectedLlmModel] = useState('gemini-3.1-pro-preview');
  const [selectedImageModel, setSelectedImageModel] = useState('imagen-3.0-generate-001');
  const [selectedImageVendor, setSelectedImageVendor] = useState('vertex');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [imageApiKey, setImageApiKey] = useState('');
  const [vertexProjectId, setVertexProjectId] = useState('gen-lang-client-0991632900');
  const [vertexLocation, setVertexLocation] = useState('global');
  const [vertexSaKeyPath, setVertexSaKeyPath] = useState('/Users/shanfu/.config/gcloud/application_default_credentials.json');

  const imageVendors = {
    google: { name: 'Google AI Studio', models: ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3.5-pro-image-preview', 'gemini-3.5-flash-image-preview', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'imagen-3.0-generate-002'] },
    vertex: { name: 'Vertex AI (GCP)', models: ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3.5-pro-image-preview', 'gemini-3.5-flash-image-preview', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'imagen-3', 'imagen-3.0-generate-002'] },
    openai: { name: 'OpenAI', models: ['dall-e-3'] },
    azure: { name: 'Azure OpenAI', models: ['gpt-image-1.5', 'image-prod'] },
    openrouter: { name: 'OpenRouter', models: ['black-forest-labs/flux-1.1-pro', 'black-forest-labs/flux.2-pro', 'google/gemini-3-pro-image', 'google/gemini-3.1-flash-image', 'google/gemini-3.5-flash-image-preview', 'google/gemini-3.1-flash-image-preview'] },
    dashscope: { name: 'Alibaba Bailian', models: ['qwen-image-2.0-pro', 'qwen-image-max'] },
    minimax: { name: 'MiniMax', models: ['image-01', 'image-01-live'] },
    seedream: { name: '火山引擎豆包', models: ['doubao-seedream-5-0-260128'] },
    replicate: { name: 'Replicate', models: ['black-forest-labs/flux-1.1-pro', 'black-forest-labs/flux-dev', 'black-forest-labs/flux-schnell', 'tencent/hunyuan-image-3'] }
  };

  return {
    llmVendors, setLlmVendors,
    selectedLlmVendor, setSelectedLlmVendor,
    selectedLlmModel, setSelectedLlmModel,
    selectedImageModel, setSelectedImageModel,
    selectedImageVendor, setSelectedImageVendor,
    llmApiKey, setLlmApiKey,
    imageApiKey, setImageApiKey,
    vertexProjectId, setVertexProjectId,
    vertexLocation, setVertexLocation,
    vertexSaKeyPath, setVertexSaKeyPath,
    imageVendors
  };
};