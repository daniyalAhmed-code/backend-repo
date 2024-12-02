export const getLabelOptionsFromConfig = (config) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(config, 'application/xml');
    const viewNode = xmlDoc.childNodes[0];
    // Find the 'Labels' node
    let labelsNode = viewNode.nodeName == 'Labels' ? viewNode : '';
    for (let i = 0; i < viewNode.childNodes.length; i++) {
      if (viewNode.childNodes[i].nodeName === 'Labels') {
        labelsNode = viewNode.childNodes[i];
        break;
      }
    }
  
    // Check if 'Labels' node is found
    if (labelsNode) {
      const labelValues = [];
      // Iterate over the children of 'Labels'
      for (let j = 0; j < labelsNode.childNodes.length; j++) {
        let childNode = labelsNode.childNodes[j];
        const val = childNode?.attributes?.getNamedItem('value');
        if(val && val?.value){
          labelValues.push(val?.value?.toString()?.toLowerCase())
        }
      }
      return labelValues;
    } else {
      console.error('Labels node not found in the XML structure.');
      return [];
    }
  };

  export const getUpdatedConfig = (labelsArr) => {
    return `<View>
      <Header value="Video timeline segmentation via Audio sync trick"/>
      <Video name="video" value="$video" sync="audio,chart"></Video>
      <Labels name="tricks" toName="audio" choice="single">
        ${ labelsArr.map(label => ( `<Label key="${label}" value="${label}"/>` ))}
      </Labels>
      <Audio name="audio" value="$video" sync="video,chart" zoom="true" speed="true" volume="true"/>
      <Chart name="chart" value="$video" sync="video,chart"/>
    </View>
    `;
  }