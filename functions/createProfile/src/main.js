import { Client, Databases, Query } from 'node-appwrite';
import fetch from 'node-fetch';

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }) => {
  // Why not try the Appwrite SDK?
  
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_BASE_URL)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);

  // You can log messages to the console
  log('Request Body Here ----------->>>>>');
  const userCount = await databases.listDocuments(
    process.env.APPWRITE_DATABASE_ID,
    'users',
    [Query.equal('user_id', req.body.userId)]
  );

  if (userCount.total < 1) {
    try {
      log("Access Token")
      log(req.body.providerAccessToken)

      const result = await fetch(`${process.env.DISCORD_BASE_URL}/users/@me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${req.body.providerAccessToken}`,
        },
      });
      const data = await result.json();
      await databases.createDocument(
        process.env.APPWRITE_DATABASE_ID,
        'users',
        req.body.userId,
        {
          user_id: req.body.userId,
          user_tag: data?.discriminator,
          username: req?.body?.name,
          ...(data?.avatar && {
            avatar: `${process.env.DISCORD_CDN_URL}/${data?.id}/${data?.avatar}.png?size=1080`,
          }),
        }
      );
      return res.json({
        ok: true,
        message: 'User created successfully!',
      });
    } catch (err) {
      error(err);
      return res.json({
        ok: false,
        message: err.message || 'Internal Server Error',
      });
    }
  } else {
    return res.json({
      ok: true,
      message: 'User already exists',
    });
  }
};
