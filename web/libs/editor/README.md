# Modified Front-End

## Features Implemented

Currently the modified frontend provides following features:

-  ### Allow labels to be filtered and selected

	This feature allows users to select `labels` dynamically on the `video-audio` page. There is a new button added which says 'Add Label'. Upon clicking the button, a modal will open. The modal contains a searchable, `select` field. Users can search and select multiple labels through the field and after the selection, click on 'Apply Selection'. This will override current config and selected labels shall be available to be selected for region drawing.

	### NOTE: 
	##### To get the above feature working, following steps must be followed and ensured:

*	When Creating a new `Project`, in the project `Settings` select `Labeling Interface` and go to `code` display of the interface. In the code section paste following code and hit `save`:

```xml
	<View>
		<Header value="Video timeline segmentation via Audio sync trick"/>
		<Video name="video" value="$video" sync="audio"></Video>
		<Labels name="tricks" toName="audio" choice="multiple">
			<Label value=""/>
		</Labels>
		<Audio name="audio" value="$video" sync="video" zoom="true" speed="true" volume="true"/>
	</View>
```
	* This is only one time process when the project is newly created.

-  ### Frame by frame shortcut keys

	This feature enables users to seek through the `video` seek bar 'Frame by Frame'. Users can go one frame forward by pressing `e`, and can go one frame backward by pressing `q` on a video. If a `hop` is required then users can hold `Shift` key and press `q` or `e` to go `10 Frames` backwards or forwards respectively. NOTE: users can change the default `hope` size from the settings menu, available in the bottom bar.

-  ### Shortcut keys for start and end region

	This feature enables users to start a region on the audio timeline and then moving forward from the starting point, when desired, end the region; by using shortcut key instead on mouse drawing. To achieve that, users can start a region by pressing `w` key and then move the seek cursor on desired position and again press `w` key to mark the region end. As soon as region end is marked, the region will be drawn, just as normally as mouse drag draws.


# Docker Setup Guide

- Make `mydata` directory at root of project  
```sh
	mkdir mydata
```
- Change ownership of `mydata` directory recursively  
```sh
	sudo chown -R 1001:root mydata
```
- Run docker compose  
```
	docker compose up --build
```

 
