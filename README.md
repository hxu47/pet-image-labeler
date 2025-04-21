# Pet Image Labeling System

A full-stack serverless application for uploading, categorizing, and labeling pet images built with React and AWS serverless technologies.

## Project Overview

The Pet Image Labeling System is a cloud-based application that enables users to upload pet images, label them with various attributes (breed, age, coat color, etc.), and view statistics about the labeled images. The system features role-based access control, with different permissions for administrators, labelers, and viewers.

### Key Features

- **User Authentication**: Secure login and registration system with role-based access control
- **Image Upload**: Upload pet images securely to the cloud
- **Image Labeling**: Categorize pets by type, breed, age, coat color, and health condition
- **Real-time Dashboard**: View statistics and metrics about labeled images
- **Admin Panel**: Manage users and their roles within the system

## Architecture

This project utilizes a serverless architecture on AWS:

![Architecture Diagram](https://github.com/hxu47/pet-image-labeler/main/images/architecture.png)

### Frontend
- React.js application with React Router and Bootstrap
- AWS Amplify for Authentication
- Hosted on EC2 with Nginx

### Backend
- AWS Lambda for serverless compute
- Amazon API Gateway for RESTful API
- Amazon S3 for image storage
- Amazon DynamoDB for database
- Amazon Cognito for authentication and authorization
- Amazon SNS for notifications
- Amazon CloudWatch for monitoring

## Technologies Used

- **Frontend**: 
  - React.js
  - Bootstrap 5
  - AWS Amplify
  - Axios

- **Backend**:
  - Node.js (Lambda runtime)
  - AWS SDK for JavaScript

- **Infrastructure as Code**:
  - AWS CloudFormation

## Deployment

The entire application is deployed using Infrastructure as Code (IaC) with AWS CloudFormation. The deployment script (`deploy.sh`) orchestrates the creation of all required resources in AWS.

### Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js and npm installed
- Bash shell environment

### Deployment Steps

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/pet-image-labeler.git
   cd pet-image-labeler
   ```

2. Run the deployment script
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. After deployment, the script will output:
   - The URL of the web application
   - The URL of the CloudWatch dashboard for monitoring

## Project Structure

```
pet-image-labeler/
├── cloudformation/         # CloudFormation templates
│   ├── api-gateway.yaml
│   ├── cognito-auth.yaml
│   ├── dynamodb-tables.yaml
│   ├── lambda-functions.yaml
│   ├── s3-storage.yaml
│   └── ...
├── lambda/                 # Lambda function code
│   ├── get-images/
│   ├── submit-labels/
│   ├── dashboard-metrics/
│   └── ...
├── pet-image-labeling-webapp/  # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   └── ...
└── deploy.sh               # Main deployment script
```

## Demonstrations

- [Infrastructure as Code Walkthrough](https://www.canva.com/design/DAGkomhp3jE/mkVwCKVo09HK560z6aEYWQ/watch?utm_content=DAGkomhp3jE&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hef4ce3fe3e)
- [Web Application Demo](https://www.canva.com/design/DAGlRimkHJc/qIKl1hbAiwaA6KEODufkVw/watch?utm_content=DAGlRimkHJc&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=ha4c35640f1)

