মিল হিসাব ম্যানেজার — Android APK বানানোর নিয়ম

১) GitHub repository-তে সব Android project file থাকতে হবে।
২) app/src/main/assets/index.html ফাইলটিও থাকতে হবে।
৩) Actions tab-এ “Build Android APK” workflow সফল হলে workflow run খুলে Artifacts থেকে mill-hisab-debug-apk.zip download করো।
৪) ZIP Extract করে app-debug.apk-তে চাপ দিয়ে Install করো।
৫) Android চাইলে Chrome/File Manager-কে “Install unknown apps” অনুমতি দাও।

গুরুত্বপূর্ণ:
- এই পদ্ধতিতে GitHub account এবং ইন্টারনেট প্রয়োজন।
- এটি Debug APK তৈরি করে; Play Store-এ প্রকাশের জন্য signed release build নয়।
- ক্লাউড sync, Firebase বা admin login এই সংস্করণে নেই।
- পুরোনো HTML অ্যাপের LocalStorage ডেটা নতুন Android অ্যাপে নিজে থেকে স্থানান্তরিত হবে না।
- পুরোনো অ্যাপের JSON backup আলাদা করে নিরাপদে রাখবে।
- Android অ্যাপের data clear বা uninstall করলে লোকাল হিসাব মুছে যেতে পারে।
