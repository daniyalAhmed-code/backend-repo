const BACK_UP = `<View>
<Header value="Video timeline segmentation via Audio sync trick"/>
<Video name="video" value="$video" sync="audio,chart"></Video>
<Labels name="tricks" toName="audio" choice="single">
  <Label value=""/>
</Labels>
<Audio name="audio" value="$video" sync="video,chart" zoom="true" speed="true" volume="true"/>
<Chart name="chart" value="$video" sync="video,chart"/>
<TimeSeriesLabels name="ts_foot_label" toName="ts_foot">
  <Label value="Run"/>
</TimeSeriesLabels> 
<TimeSeries name="ts_foot" valueType="json" value="$ts_foot" fixedScale='false' overviewWidth='30%'>
  <Channel column="gyro_x" fixedScale='true' strokeColor="#f89951" legend="gyro_x"/>
  <Channel column="gyro_y" fixedScale='true' strokeColor="#87bb84" legend="gyro_x"/>
  <Channel column="gyro_z" fixedScale='true' strokeColor="#90b4d3" legend="gyro_z"/>
</TimeSeries>
</View>`;

export const DEFAULT_CONFIG = `<View>
<Header value="Video timeline segmentation via Audio sync trick"/>
<Video name="video" value="$video" sync="audio,chart"></Video>
<Labels name="tricks" toName="audio" choice="single">
  <Label value=""/>
</Labels>
<Audio name="audio" value="$video" sync="video,chart" zoom="true" speed="true" volume="true"/>
<Chart name="chart" value="$video" sync="video,chart"/>
</View>`;