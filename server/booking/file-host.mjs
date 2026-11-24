import {createNodeBookingHost} from './node-host.mjs';
import {existingMediaUploader} from './existing-media-adapter.mjs';
const host=await createNodeBookingHost({identityFile:process.env.UTOPY_BOOKING_IDENTITY_FILE,manifestFile:process.env.UTOPY_BOOKING_MANIFEST_FILE});
export const {runtime,getManifest,authorizeNode}=host;
export const uploadMedia=process.env.UTOPY_BOOKING_MEDIA_ENDPOINT?existingMediaUploader({endpoint:process.env.UTOPY_BOOKING_MEDIA_ENDPOINT,headers:JSON.parse(process.env.UTOPY_BOOKING_MEDIA_HEADERS||'{}')}):undefined;
