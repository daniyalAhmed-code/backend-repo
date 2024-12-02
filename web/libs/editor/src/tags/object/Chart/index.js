import { inject, observer } from 'mobx-react';
import Registry from '../../../core/Registry';

import { ApiChartView } from './ApiChart';
import { ChartModel } from './Chart';

const MultiLineChart = inject('store')(observer(ApiChartView));

Registry.addTag('chart', ChartModel, MultiLineChart);
Registry.addObjectType(ChartModel);

export { ChartModel, MultiLineChart };
