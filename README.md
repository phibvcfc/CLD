This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

>**Note**: Make sure you have completed the [React Native - Environment Setup](https://reactnative.dev/docs/environment-setup) instructions till "Creating a new application" step, before proceeding.

## Step 1: Start the Metro Server

First, you will need to start **Metro**, the JavaScript _bundler_ that ships _with_ React Native.

To start Metro, run the following command from the _root_ of your React Native project:

```bash
# using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Start your Application

Let Metro Bundler run in its _own_ terminal. Open a _new_ terminal from the _root_ of your React Native project. Run the following command to start your _Android_ or _iOS_ app:

### For Android

```bash
# using npm
npm run android

# OR using Yarn
yarn android
```

### For iOS

```bash
# using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up _correctly_, you should see your new app running in your _Android Emulator_ or _iOS Simulator_ shortly provided you have set up your emulator/simulator correctly.

This is one way to run your app — you can also run it directly from within Android Studio and Xcode respectively.

## Step 3: Modifying your App

Now that you have successfully run the app, let's modify it.

1. Open `App.tsx` in your text editor of choice and edit some lines.
2. For **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Developer Menu** (<kbd>Ctrl</kbd> + <kbd>M</kbd> (on Window and Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (on macOS)) to see your changes!

   For **iOS**: Hit <kbd>Cmd ⌘</kbd> + <kbd>R</kbd> in your iOS Simulator to reload the app and see your changes!

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [Introduction to React Native](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you can't get this to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.



* Cơ chế sync data giữa Calendar OS -> App Hansin 

Android

+ Đang dùng Calendar Content Provider để lấy events từ Calendar os
+ Cần cấp quyền WRITE_CALENDAR và READ_CALENDAR để lấy events từ Calendar os vào app, thông qua CalendarContract
+ Dùng query CONTENT_URI để lấy events CalendarContract

IOS
+ Sử dụng EKEventStore để yêu cầu quyền truy cập vào các sự kiện trong lịch của người dùng.
+ Sử dụng EKEventStore để truy vấn và lấy danh sách các sự kiện từ lịch.
+ Thêm mới, cập nhật hoặc xóa sự kiện từ lịch thông qua các API của EventKit.


* Outlook -> Calendar OS -> Hansin 
 và Google Calendar -> Calendar OS -> App Hansin 

- Từ Outlook/Google Calendar sync qua Calendar OS thông qua account đã đăng nhập.  Được xử lý bởi hệ điều hành thông qua việc cấu hình tài khoản Outlook/Google calendar trong phần cài đặt của thiết bị.
- Calendar sẽ tự động đồng bộ thông qua account đã đăng nhập và config.





 -Các trường hợp đồng bộ:
+ Thêm sự kiện mới
+ Cập nhật sự kiện hiện có
+ Xóa sự kiện

- Timing đồng bộ:
+ Đồng bộ định kỳ (ví dụ: mỗi 5/10 or 15 phút/lần) khii ở forceground
+ Đồng bộ khii người dùng mở/hoặc resume lại ứng dụng
+ Đồng Bộ Thủ Công (tạo Button đồng bộ thủ công)

- Handle khii đồng bộ gặp sự cố.
+ Xử lý check app calendar os (ví dụ như samsung thì có Samsung calendar, google pixel thì có google calendar) có tồn tại trên device chưa, nếu chưa thì check các app như outlook, google calendar để tránh lỗi không có data.
+ Các ngoại lệ khii thực hiện các thao tác trên Calendar OS
+ Thông báo cho người dùng về lỗi xảy ra và yêu cầu họ thử lại sau.

- Đối với ios trên tài liệu có ghii: iOS settings in Settings > Calendar > Sync > All Events
- Đối với app outlook cần vào setting enable Sync Calendars.

=> Cách làm
- Sử dụng AsyncStorage để lưu trữ thông tin lasttime đồng bộ cuối cùng và trạng thái đồng bộ (khii đã mở app)
- Xử lý lỗi: Triển khai cơ chế retry với thời gian chờ tăng dần. (ví dụ như lần retry đầu tiên thì chờ 10s các lần tiếp theo thì + thêm 10s)
- Chỉ đồng bộ những thay đổi mới thay vì toàn bộ dữ liệu mỗi lần.
-Sử dụng AsyncStorage hoặc sử dụng  Local Database  để lưu các thông tin như 
    id
    title
    startDate
    endDate
    description
 để check các event được delete or update từ calendar os
