import type { StationId } from '../../../layout';
import type { BuiltModel } from '../../../kit';
import { build as about } from './about';
import { build as education } from './education';
import { build as publications } from './publications';
import { build as work } from './work';
import { build as projects } from './projects';
import { build as coursework } from './coursework';
import { build as awards } from './awards';
import { build as involvement } from './involvement';

/** One file per landmark (model = public/models/vox/<id>.vox). */
export const voxLandmarks: Record<StationId, () => BuiltModel> = {
  about, education, publications, work, projects, coursework, awards, involvement,
};
