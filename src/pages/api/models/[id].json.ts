import type { APIRoute, GetStaticPaths } from 'astro';
import { toModelDrawerPayload } from '../../../lib/model-api';
import {
  enrichModelsWithPublicCatalogData,
  getModels,
  getPublicCatalogModels,
} from '../../../lib/supabase';

type ModelDetailPayload = ReturnType<typeof toModelDrawerPayload>;
type Props = {
  model: ModelDetailPayload;
};

export const getStaticPaths = (async () => {
  const [models, publicCatalogs] = await Promise.all([
    getModels(),
    getPublicCatalogModels(),
  ]);

  return enrichModelsWithPublicCatalogData(models, publicCatalogs).map(
    (model) => ({
      params: { id: model.id },
      props: { model: toModelDrawerPayload(model) },
    }),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(JSON.stringify(props.model), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
