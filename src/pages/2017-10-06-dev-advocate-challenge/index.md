---
title: Static Site Alterations with a single Stitch
date: "2017-10-06T22:12:03.284Z"
path: "/dev-advocate-challenge/"
---
Static sites are the new hotness. It’s never been so easy to quickly [spin up your own blog](https://github.com/gatsbyjs/gatsby-starter-blog) using a static site generator like [GatsbyJS](https://www.gatsbyjs.org/). You can even [host somewhere like Netlify](https://www.netlify.com/blog/2016/02/24/a-step-by-step-guide-gatsby-on-netlify/), connecting it to a Github repo. Publishing a new post is literally a pull request away.

This is great as long as the site remains static. But once you decide to add functionality that requires a database or calling out to another service, you’re going to need a backend. Traditionally, this involves creating an application using a server-side language such as Node.js and hosting it somewhere like Heroku. Depending on the functionality you’re adding, this could add more overhead and an additional codebase.

But what if it didn’t have to?

##A Stitch in time saves nine
Recently, MongoDB introduced Stitch, a Backend as a Service that allows you to access a MongoDB collection and integrate external services. This allows you to access information from the client-side. You also have the ability to execute pipelines that perform multiple functions for a single request.

Going back to our static blog site example, we can now easily implement features such as comments and notifications using very little code. Let’s create a simple React component that allows readers to submit and view comments for each post. We’ll also fire off an email, alerting the blogger of the new comment. We’ll utilize MongoDB Atlas for the data store and SparkPost for sending the notification email.

##Create your blog
We’re going to start with a GatsbyJS site generated using the [gatsby-starter-blog](https://github.com/gatsbyjs/gatsby-starter-blog) starter.
```
> npm install --global gatsby-cli
> gatsby new gatsby-blog https://github.com/gatsbyjs/gatsby-starter-blog
```

We’re going to modify the site slightly so we have access to the path frontmatter variable. We’ll use this as our unique `post_id`. Locate `blog-post.js` in `/src/templates` and modify the `pageQuery` to include path.
```
export const pageQuery = graphql`
  query BlogPostByPath($path: String!) {
    site {
      siteMetadata {
        title
        author
      }
    }
    markdownRemark(frontmatter: { path: { eq: $path } }) {
      id
      html
      frontmatter {
        path
        title
        date(formatString: "MMMM DD, YYYY")
      }
    }
  }
`
```
We’re now ready to set up our Stitch Application and create our React Component.

##Create a Stitch Application
[Log in](https://www.mongodb.com/cloud) to your MongoDB Atlas account. If you do not have an Atlas account, follow the instructions in the Atlas [documentation to create an account](https://docs.atlas.mongodb.com/getting-started/).

###Initialize a new Stitch App
Click Stitch Apps in your MongoDB Atlas console and then click Create New Application. We’ll name this application blog_comments. It will take a few moments for the new application to initialize.

###Enable Anonymous Authentication and create the comments collection
For this simple application, we want anyone to be able to comment on a blog post.
1. In the application page, turn on Anonymous Authentication.
2. In the left navigation panel, under Atlas Clusters click mongodb-atlas and select the Rules tab.
3. Click New to add a new MongoDB Collection.
4. Enter `blog` for the Database, `comments` for the Collection, and click Create.
5. Click the newly created `blog.comments`.
6. Click the Filters tab.
7. Delete the existing filter and click Save.
8. Click the Field Rules tab.
9. For Permissions on top-level document, change the Read rule to `{}` and click Save.

We now have a database to store comments created by anyone.

###Create a new HTTP Service
In order to trigger the email notification, we’re going to need to create a new HTTP Service for SparkPost. We’re going to assume that you have a [SparkPost](https://www.sparkpost.com/) account and an API Key with Read/Write permissions for Transmissions. If you don’t, head over to SparkPost to [get started](https://www.sparkpost.com/docs/getting-started/getting-started-sparkpost/).
1. In the left navigation panel, under Services click Add Service.
2. Select HTTP and give it the name SparkPost and click Create Service.
3. Click the Rules tab.
4. Enable the `post` Action.
5. For security and to protect our sending reputation, we want to ensure posts using this service only go to the SparkPost endpoint and emails are only sent to whitelisted address. Set the following as the When and click Save:

```
{
  "%%args.url.host": "api.sparkpost.com",
  "%%args.body.recipients.address": {
    "%in": [
      <your email addresses>
    ]
  }
}
```

6. In the left navigation panel, under Control click Add Values. We can use values to store global information and retrieve it using `%%values`.
7. Create an `sp-endpoint` value and set it to `"https://api.sparkpost.com/api/v1/"`.
8. Create an `sp-api-key` value and set it to your SparkPost API Key.

###Configure the Named Pipeline
We need this pipeline to perform two tasks: Add the comment to the collection and send an email. Because an insert can’t be the first stage in a pipeline, we’ll need to three stages.
1. In the left navigation panel, under Control click Pipelines.
2. Click New Pipeline and give it the name `AddComment`.
3. Add Parameters for `post`, `comment`, `author`, `timestamp`, and `owner_id` making `post` and `owner_id` required. (We’ll be passing these values from the client-side.)
4. Add the following 3 stages.

####Stage 0: Process the data passed in
This stage accepts the arguments from `%%args` and returns a document to be inserted into the collection in the next step.
1. Hover over the stage and click Edit.
2. Ensure the Service is set to built-in and the Action is literal.
3. Click the toggle for Bind Data to `%%vars` and add the following:

```
{
  "post_id": "%%args.post.frontmatter.path",
  "owner_id": "%%args.owner_id",
  "comment": "%%args.comment",
  "author": "%%args.author",
  "timestamp": "%%args.timestamp"
}
```

4. Change the contents in the box above to:

```
{
  "items": [
    "%%vars"
  ]
}
```

5. Click Done.

####Stage 1: Insert the comment into the collection
Now we can take the result of Stage 0 and insert it into the comments collection.
1. Click Add Stage.
2. Hover over the stage and click Edit.
3. Set the Service to mongodb-atlas and the Action to insert.
4. Change the database value to blog and the collection value to comments.
5. Click Done.

####Stage 2: Send the notification email
Now we can issue a post to the SparkPost service and pass along the information passed in as substitution data for the email template. You can learn more about using the Transmissions endpoint in the SparkPost [API Documentation](https://developers.sparkpost.com/api/transmissions).
1. Click Add Stage.
2. Hover over the stage and click Edit.
3. Set the Service to SparkPost and the Action to post.
4. Click the toggle for Bind Data to `%%vars` and add the following:

```
{
  "url": {
    "%concat": [
      "%%values.sp-endpoint",
      "transmissions"
    ]
  },
  "substitution_data": {
    "post": "%%args.post",
    "comment": "%%args.comment",
    "author": "%%args.author",
    "timestamp": "%%args.timestamp"
  }
}
```

5. Change the contents in the box above to:

```
{
  "url": "%%vars.url",
  "headers": {
    "Authorization": [
      "%%values.sp-api-key"
    ],
    "Content-Type": [
      "application/json"
    ]
  },
  "body": {
    "recipients": [
      {
        "address": <whitelisted email address>
      }
    ],
    "content": {
      "template_id": <your template-id>
    },
    "substitution_data": "%%vars.substitution_data"
  }
}
```

6. Click Done.
7. That was the last stage. Click Save.

###Test your the Pipeline
We can use the Debug Console to test our newly created pipeline.
1. In the left navigation panel, under Control click Add Debug Console.
2. Hover over the stage and click Edit.
3. Ensure the Service is set to built-in and the Action is literal.
4. Click the toggle for Bind Data to `%%vars` and add the following:

```
{
  "output": {
    "%pipeline": {
      "name": "AddComment",
      "args": {
        "post": {
          "id": "1234",
          "frontmatter": {
            "title": "Test post"
          }
        },
        "owner_id": "1234",
        "comment": "Hey yo!",
        "author": "Aydrian",
        "timestamp": "1234"
      }
    }
  }
}
```

5. Change the contents in the box above to:

```
{
  "items": [
    "%%vars.output"
  ]
}
```

6. Click Done.
7. Click Execute.

If all went well, you should see results and receive an email. Now let’s use this application in our new component.

##Creating the Comments Component
In order to access our Stitch Application from the client-side, we’re going to need to install the javascript sdk.
```
> npm install --save mongodb-stitch
```

This component will need to do 2 things:
1. Query the collection componentWillMount and display the result.
2. Accept user input and pass it to our named pipeline.

Create a new file in the `/src/components` folder called `Comments.js`. In order to access the Stitch application, you’ll need to import the SDK and initialize a client. For this you’ll need to grab your App ID from the Getting Started section of the `blog_comments` application page.

```
import { StitchClient } from 'mongodb-stitch'
const stitchClient = new StitchClient('<App ID>')
```

If you want to read from the blog database, you can access it using the stitchClient.

```
const db = stitchClient.service('mongodb', 'mongodb-atlas').db('blog')
stitchClient
  .login()
  .then(
    db.collection('comments').find().then(comments => {...})
  )
```

You can also execute your named pipeline.

```
stitchClient.login().then(() => {
      stitchClient.executeNamedPipeline('AddComment', {
        <args>
      })
        .then(result => {
          console.log(result)
        })
})
```

You can find the complete component code [here](https://github.com/aydrian/stitchcraft/blob/master/src/components/Comments.js).

##Adding Comments to Posts
Now that we have a comments component that interacts with a Stitch application, we can add it to the blog-post template. Open `/src/templates/blog-post.js` and import the `Comments` component.

```
import Comments from '../components/Comments'
```

Add the component under the <Bio> component passing the post object as a prop.

```
<Comments post={post} />
```

That’s it. You can now fire up the Gatsby development server, open http://localhost:8000 in your browser and try it out.
```
> gatsby develop
```

Check out the [full repo](https://github.com/aydrian/stitchcraft) for this example.

This was just a simple example and there are many ways it could be extended. We were able to quickly build a pipeline that not only accessed MongoDB but also leveraged external services while writing very little code. Using Stitch, we were able to add needed functionality quickly and with little overhead.

What could a Stitch application do for you? Give it a try and let us know.

-- Aydrian
