import { types } from 'mobx-state-tree';

import NormalizationMixin from '../mixins/Normalization';
import RegionsMixin from '../mixins/Regions';
import { AreaMixin } from '../mixins/AreaMixin';
import Registry from '../core/Registry';
import { FF_DEV_2715, isFF } from '../utils/feature-flags';

import { ChartUltraRegionModel as _chartUltraRegionModel } from './ChartRegion/ChartUltraRegionModel';
import { ChartRegionModel as _chartRegionModel } from './ChartRegion/ChartRegionModel';
import { EditableRegion } from './EditableRegion';

// this type is used in auto-generated documentation
/**
 * @example
 * {
 *   "original_length": 18,
 *   "value": {
 *     "start": 3.1,
 *     "end": 8.2,
 *     "channel": 0,
 *     "labels": ["Voice"]
 *   }
 * }
 * @typedef {Object} ChartRegionResult
 * @property {number} original_length length of the original chart (seconds)
 * @property {Object} value
 * @property {number} value.start start time of the fragment (seconds)
 * @property {number} value.end end time of the fragment (seconds)
 * @property {number} value.channel channel identifier which was targeted
 */

const EditableChartModel = types
  .model('EditableChartModel', {})
  .volatile(() => ({
    editableFields: [
      { property: 'start', label: 'Start' },
      { property: 'end', label: 'End' },
    ],
  }));

const ChartRegionModel = types.compose(
  'ChartRegionModel',
  RegionsMixin,
  AreaMixin,
  NormalizationMixin,
  EditableRegion,
  EditableChartModel,
  _chartRegionModel,
);

const ChartUltraRegionModel = types.compose(
  'ChartRegionModel',
  RegionsMixin,
  AreaMixin,
  NormalizationMixin,
  EditableRegion,
  EditableChartModel,
  _chartUltraRegionModel,
);

let _exportChartRegion = ChartRegionModel;

if (isFF(FF_DEV_2715)) {
  _exportChartRegion = ChartUltraRegionModel;
}

Registry.addRegionType(_exportChartRegion, 'chartplus');
Registry.addRegionType(_exportChartRegion, 'chart');

export { _exportChartRegion as ChartRegionModel };
