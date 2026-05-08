UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'audio/mpeg','audio/mp4','audio/wav','audio/x-m4a',
      'audio/aac','audio/ogg','audio/webm'
    ]
WHERE id = 'voices';

UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'uploads';