# 如何获取 Google Calendar API 的 `gcal_credentials.json` 文件

本文档详细说明了如何通过 Google Cloud Console 创建一个服务账号 (Service Account) 并获取用于访问 Google Calendar API 的 `gcal_credentials.json` 凭证文件。服务账号适用于服务器到服务器的交互，例如后端应用访问 Google API，无需用户直接授权。

---

### 第一步：访问 Google Cloud Console 并选择项目

1.  打开浏览器，访问 [Google Cloud Console](https://console.cloud.google.com/)。
2.  在页面顶部的导航栏中，从项目下拉列表中选择您的目标项目。确保您正在为正确的项目配置凭证。

### 第二步：启用 Google Calendar API

1.  在左侧导航菜单中，找到并点击 **"APIs & Services" > "Library"**。
2.  在 API 库的搜索框中，输入 "Google Calendar API" 并按回车。
3.  在搜索结果中点击 "Google Calendar API"。
4.  如果 API 尚未启用，请点击 **"Enable"** 按钮。

### 第三步：创建服务账号 (Service Account)

1.  启用 API 后，在左侧导航菜单中，转到 **"APIs & Services" > "Credentials"**。
2.  点击页面顶部的 **"+ CREATE CREDENTIALS"** 按钮，然后从下拉菜单中选择 **"Service account"**。
3.  **填写服务账号详情**:
    *   **Service account name**: 为您的服务账号设置一个描述性名称（例如, `schedule-calendar-service`)。
    *   **Service account ID**: 系统会自动根据名称生成一个 ID。您可以保留默认值。
    *   **Description**: 添加一段描述，说明此服务账号的用途（例如, "Accesses Google Calendar for the schedule module"）。
4.  点击 **"CREATE AND CONTINUE"**。

### 第四步：创建和下载密钥 (Key)

1.  创建服务账号后，系统会进入 "Grant this service account access to project" 步骤，此步骤是可选的，您可以直接跳过，点击 **"CONTINUE"**。
2.  在 "Grant users access to this service account" 步骤中，您也无需添加任何内容，直接点击 **"DONE"**。
3.  您现在会返回到 "Credentials" 页面。在服务账号列表中找到您刚刚创建的账号。
4.  点击该服务账号的名称进入其详情页。
5.  选择 **"KEYS"** 标签页。
6.  点击 **"ADD KEY"** 按钮，然后选择 **"Create new key"**。
7.  在弹出的窗口中，选择 **"JSON"** 作为密钥类型，然后点击 **"CREATE"**。
8.  浏览器将自动下载一个 JSON 文件。**这个文件就是您的凭证文件**。

### 第五步：重命名并安全地管理凭证文件

1.  将下载的 JSON 文件重命名为 `gcal_credentials.json`，或您的应用程序配置所期望的任何名称。
2.  **【重要安全提示】**:
    *   **严禁将此凭证文件提交到公共代码仓库 (如 GitHub)！**
    *   此文件包含私钥，泄露后可能导致您的 Google Cloud 资源被恶意访问。
    *   最佳实践是使用秘密管理工具（如 Google Secret Manager）或安全地将其作为环境变量加载到您的应用中。
    *   对于 Google App Engine 部署，您可以将此文件与您的应用代码一起上传，但请确保已将其添加到 `.gcloudignore` 文件中，以防止其被意外暴露。

### 第六步：与目标 Google Calendar 共享

为了让您的服务账号能够访问特定的日历，您需要将服务账号的电子邮件地址添加到该日历的共享列表中。

1.  打开您刚刚下载的 `gcal_credentials.json` 文件。
2.  找到并复制 `client_email` 字段的值。它看起来像这样：`your-service-account-name@your-project-id.iam.gserviceaccount.com`。
3.  打开您希望通过 API 管理的 [Google Calendar](https://calendar.google.com/)。
4.  找到目标日历，点击旁边的三个点，选择 **"Settings and sharing"**。
5.  在左侧菜单中，向下滚动到 **"Share with specific people or groups"** 部分，点击 **"Add people and groups"**。
6.  在输入框中粘贴您复制的服务账号 `client_email`。
7.  在 **"Permissions"** 下拉菜单中，授予适当的权限。通常，**"Make changes to events"** 是必需的，以便创建、修改和删除事件。
8.  点击 **"Send"**。

---

至此，您已成功获取 `gcal_credentials.json` 文件，并配置了访问特定日历所需的权限。您的后端应用程序现在可以使用此文件通过 Google Calendar API 进行身份验证和操作。