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
    google: { name: 'Google AI Studio', models: ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview'] },
    replicate: { name: 'Replicate', models: ['tencent/hunyuan-image-3', 'black-forest-labs/flux-schnell'] },
    vertex: { name: 'Vertex AI (GCP)', models: ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'imagen-3.0-generate-001'] }
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