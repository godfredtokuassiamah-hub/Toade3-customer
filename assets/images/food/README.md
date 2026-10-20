# Food images

Add photos here (about 600px wide, landscape, 60 KB or less each; JPEG or PNG). Any item marked "no" renders a grey placeholder card in the app until you add a file and wire it up in `src/data/mock/foodImages.ts` (replace the item's `undefined` with `require("../../../assets/images/food/<file>")`). The suggested filenames below are only a convention; the `require()` path is what counts.

| Section | Item id | File | Dish | Present |
| --- | --- | --- | --- | --- |
| Local meals | lm-grilled-chicken-wedges | grilled-chicken-wedges.png | Grilled Chicken & Wedges | yes |
| Local meals | lm-beef-veggie-rice | beef-veggie-rice.png | Beef & Veggie Rice | yes |
| Local meals | lm-jollof-chicken | local-jollof-chicken.jpg | Jollof rice with grilled chicken | yes |
| Local meals | lm-waakye | local-waakye.jpg | Waakye | no |
| Local meals | lm-banku-tilapia | local-banku-tilapia.jpg | Banku & grilled tilapia | no |
| Local meals | lm-fried-rice-chicken | local-fried-rice-chicken.jpg | Fried rice with grilled chicken | yes |
| Drinks | dr-matcha-bubble-tea | matcha-boba.png | Matcha bubble tea | yes |
| Drinks | dr-bliss-sparkling-juice | bliss-sparkling-juice.png | Bliss sparkling juice | yes |
| Drinks | dr-sobolo | drink-sobolo.jpg | Sobolo (hibiscus) | no |
| Drinks | dr-orange-juice | drink-orange-juice.jpg | Fresh orange juice | no |
| Drinks | dr-iced-coffee | drink-iced-coffee.jpg | Iced coffee | no |
| Drinks | dr-mango-smoothie | drink-mango-smoothie.jpg | Mango smoothie | no |
| Bakery & Desserts | bk-sliced-bread | sliced-bread.png | Sliced bread | yes |
| Bakery & Desserts | bk-chocolate-cake | chocolate-cake.png | Chocolate cake | yes |
| Bakery & Desserts | bk-meat-pie | bakery-meat-pie.jpg | Meat pie | no |
| Bakery & Desserts | bk-croissant | bakery-croissant.jpg | Butter croissant | no |
| Bakery & Desserts | bk-doughnuts | bakery-doughnuts.jpg | Doughnuts | no |

The avatar is optional: `assets/images/avatar-placeholder.jpg` (160x160). Until it exists, the app shows an initials circle. To use it, set `user.avatar: require("../../../assets/images/avatar-placeholder.jpg")` in `src/data/mock/home.ts`.

## Credits

Use only photos you own or that are licensed for app use (for example the Unsplash License or the Pexels License). Pinterest images are not licensed for reuse. Add a row here for every photo you add.

| File | Source | Photographer | License |
| --- | --- | --- | --- |
| local-jollof-chicken.jpg | https://www.pexels.com/photo/grilled-chicken-with-jollof-rice-and-vegetables-40262791/ | Mohammad Fahim | [Pexels License](https://www.pexels.com/license/) |
| local-fried-rice-chicken.jpg | https://www.pexels.com/photo/delicious-grilled-chicken-with-fried-rice-40262783/ | Mohammad Fahim | [Pexels License](https://www.pexels.com/license/) |
| grilled-chicken-wedges.png | User's own design, copy of `assets/Homepage photos/Rectangle 163.png` | n/a | Project-owned asset |
| beef-veggie-rice.png | User's own design, copy of `assets/Homepage photos/Rectangle 163-1.png` | n/a | Project-owned asset |
| matcha-boba.png | User's own design, copy of `assets/Homepage photos/Rectangle 163-2.png` | n/a | Project-owned asset |
| bliss-sparkling-juice.png | User's own design, copy of `assets/Homepage photos/Rectangle 163-3.png` | n/a | Project-owned asset |
| sliced-bread.png | User's own design, copy of `assets/Homepage photos/Rectangle 163-4.png` | n/a | Project-owned asset |
| chocolate-cake.png | User's own design, copy of `assets/Homepage photos/Rectangle 163-5.png` | n/a | Project-owned asset |

The six user-supplied PNGs are 169x100 (1x) crops of the Home mock, so they look soft on 3x screens. Replace them with larger exports (about 600px wide) when available.

No Pinterest images were used. The banners in `assets/images/banners/` are JPEG copies of the app's own `assets/UI SCREEN/Banner` artwork, made with PowerShell System.Drawing.
