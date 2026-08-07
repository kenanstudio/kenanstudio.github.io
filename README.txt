KENAN STUDIO WEBSITE
====================

This is a complete static website. No build step, database or server-side code is required.

IMPORTANT BEFORE PUBLISHING
---------------------------
1. Open: site-config.js
2. Find:
     contactEmail: "",
3. Put your public support/business email between the quotes.
   Example:
     contactEmail: "support@example.com",
4. Save the file.

The 3D Collider Asset Store link is already configured as:
https://assetstore.unity.com/packages/slug/398482
It may show an unavailable page until Unity publishes the package.

EASIEST FREE HOSTING: NETLIFY DROP
----------------------------------
1. Go to https://app.netlify.com/drop
2. Unzip this archive.
3. Drag the entire Kenan_Studio_Website folder onto the Netlify Drop page.
4. Netlify will give you a public HTTPS website URL.
5. Put that URL into the Website field of your Unity Publisher Profile.

FREE HOSTING: GITHUB PAGES
--------------------------
1. Create a GitHub repository, for example: kenan-studio-site
2. Upload every file and folder from this website archive to the repository root.
3. In GitHub open Settings > Pages.
4. Under Build and deployment choose: Deploy from a branch.
5. Select branch: main, folder: / (root), then Save.
6. GitHub will display the public HTTPS website URL after deployment.
7. Put that URL into the Website field of your Unity Publisher Profile.

LOCAL PREVIEW
-------------
You can double-click index.html to preview the site, but a local web server is more reliable.
On macOS, open Terminal inside this folder and run:

python3 -m http.server 8000

Then open:
http://localhost:8000

FILES
-----
index.html       Main page
styles.css       Website design and responsive layout
script.js        Navigation, gallery/lightbox and contact logic
site-config.js   Easy-to-edit email and Asset Store URL
assets/          Images and favicon

The site is responsive and works on desktop and mobile browsers.
