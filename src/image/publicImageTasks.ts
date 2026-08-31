export interface PublicImageTask {
  id: string;
  name: string;
  shortName: string;
  description: string;
  keywords: string[];
  featured?: boolean;
}

export const PUBLIC_IMAGE_TASKS: PublicImageTask[] = [
  { id:'crop-image', name:'Crop Image', shortName:'Crop Image', description:'Crop an image to a freeform rectangle or common aspect ratio entirely in your browser.', keywords:['crop image','photo cropper','trim image','aspect crop'], featured:true },
  { id:'rotate-flip-image', name:'Rotate & Flip Image', shortName:'Rotate / Flip', description:'Rotate photos by 90° steps or flip them horizontally or vertically without uploading them.', keywords:['rotate image','flip image','mirror photo','orientation'], featured:true },
  { id:'heic-image-converter', name:'HEIC / HEIF Image Converter', shortName:'HEIC Converter', description:'Convert HEIC or HEIF photos when the current browser can decode them, with an explicit unsupported-browser fallback.', keywords:['heic to jpg','heif to jpg','iphone photo converter','heic png'] },
  { id:'avif-image-converter', name:'AVIF Image Converter', shortName:'AVIF Converter', description:'Convert AVIF images to PNG, JPEG, or WebP locally when supported by the browser image decoder.', keywords:['avif to jpg','avif to png','avif webp','convert avif'] },
  { id:'svg-to-image', name:'SVG to PNG / JPG', shortName:'SVG Converter', description:'Render SVG artwork to a raster PNG or JPEG at a chosen size without sending the SVG anywhere.', keywords:['svg to png','svg to jpg','svg rasterizer','convert svg'] },
  { id:'image-format-converter', name:'JPG, PNG & WebP Converter', shortName:'Image Converter', description:'Convert common image formats between JPEG, PNG, and WebP with quality control.', keywords:['jpg to png','png to jpg','webp to jpg','jpg to webp','png to webp'], featured:true },
  { id:'compress-image-to-size', name:'Compress Image to Target Size', shortName:'Target Size Compress', description:'Aim for a target KB or MB file size using bounded quality search and high-quality resizing.', keywords:['compress image to 200kb','image target size','reduce photo size','compress jpg kb'], featured:true },
  { id:'batch-image-converter', name:'Batch Image Converter', shortName:'Batch Converter', description:'Convert multiple browser-decodable images to JPEG, PNG, or WebP in one local batch.', keywords:['batch image converter','convert many photos','bulk jpg png webp'] },
  { id:'profile-picture-maker', name:'Profile Picture Maker', shortName:'Profile Picture', description:'Create square or circular profile pictures with centered crop controls and transparent PNG output.', keywords:['profile picture','circle crop','avatar maker','pfp crop'], featured:true },
  { id:'blur-pixelate-image', name:'Blur & Pixelate Image', shortName:'Blur / Pixelate', description:'Blur or pixelate an entire image with adjustable strength for quick visual obfuscation.', keywords:['blur image','pixelate photo','mosaic image','blur photo'] },
  { id:'privacy-blur-image', name:'Privacy Blur / Redactor', shortName:'Privacy Blur', description:'Manually blur or pixelate selected rectangles such as faces, names, screens, addresses, or license plates.', keywords:['face blur','privacy blur','redact image','blur license plate','hide personal info'], featured:true },
  { id:'image-metadata-cleaner', name:'Image Metadata Viewer & Cleaner', shortName:'Metadata Cleaner', description:'Inspect common JPEG EXIF metadata and export a clean re-encoded copy that strips embedded metadata.', keywords:['exif viewer','remove photo metadata','gps metadata','privacy metadata','clean exif'], featured:true },
  { id:'social-media-image-resizer', name:'Social Media Image Resizer', shortName:'Social Resizer', description:'Resize and crop images to common post, story, thumbnail, banner, and profile dimensions.', keywords:['instagram size','youtube thumbnail','social media image size','story resize','banner resize'] },
  { id:'favicon-maker', name:'Favicon & ICO Maker', shortName:'Favicon Maker', description:'Create favicon-ready PNG sizes and a standards-compatible PNG-backed ICO file from one image.', keywords:['favicon maker','png to ico','jpg to ico','website icon','favicon generator'] },
  { id:'image-grid-splitter', name:'Image Grid Splitter', shortName:'Grid Splitter', description:'Split one image into equal rows and columns for tiles, carousels, print layouts, or social grids.', keywords:['split image grid','instagram grid','image tiles','cut photo grid'] },
  { id:'image-border-frame', name:'Add Border / Frame to Image', shortName:'Image Border', description:'Add an inside or outside solid border around an image with configurable width and color.', keywords:['add border to image','photo frame','image outline','white border'] },
  { id:'photo-filters', name:'Photo Filters & Adjustments', shortName:'Photo Filters', description:'Adjust brightness, contrast, saturation, grayscale, sepia, and hue with local canvas filters.', keywords:['photo filter','brightness contrast','saturation','grayscale','sepia'] },
  { id:'image-compare', name:'Image Compare Slider', shortName:'Image Compare', description:'Compare two images side by side or with an interactive before/after reveal slider.', keywords:['before after image','compare photos','image slider','visual diff'] },
  { id:'background-changer', name:'Image Background Changer', shortName:'Background Changer', description:'Remove a foreground background locally, then place the subject on a chosen solid-color background.', keywords:['change photo background','replace background','white background','background color'] },
  { id:'transparent-image-maker', name:'Make Image Background Transparent', shortName:'Transparent Background', description:'Create a transparent PNG using the existing local background-removal engine.', keywords:['transparent background','remove background png','make png transparent'], featured:true },
  { id:'contact-sheet-maker', name:'Contact Sheet Maker', shortName:'Contact Sheet', description:'Lay multiple images out on a labeled or unlabeled grid and export one combined sheet.', keywords:['contact sheet','photo sheet','thumbnail sheet','image grid collage'] },
  { id:'image-upscaler', name:'Image Upscaler', shortName:'Upscale Image', description:'Upscale an image with high-quality browser resampling up to 4× without claiming AI-generated detail.', keywords:['upscale image','enlarge photo','resize bigger','high quality upscale'] },
  { id:'headshot-cropper', name:'Headshot & Portrait Cropper', shortName:'Headshot Cropper', description:'Create consistent portrait and headshot crops with guided framing and common square/portrait ratios.', keywords:['headshot crop','portrait crop','linkedin photo','professional profile crop'] },
];

export function getPublicImageTask(id: string | null | undefined): PublicImageTask | undefined {
  return PUBLIC_IMAGE_TASKS.find((task) => task.id === id);
}
