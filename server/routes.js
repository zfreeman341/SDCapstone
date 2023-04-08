const path = require('path')
const {Router} = require('express')
const router = Router()
const axios = require('axios')
const dotenv = require('dotenv')
const { ConcatenationScope } = require('webpack')
const db = require('./database.js')

// Heroku API info
const HEROKU_API_END_POINT = 'https://app-hrsei-api.herokuapp.com/api/fec2/hr-rfe'
const HEROKU_HEADERS = {
  "Authorization" : `${process.env.API_KEY}`
}



// =====================================
//         Things to do for all...
// =====================================


router.all('*', (req, res, next) => {

  // Set options with our authorization and any passed in query parameters
  let options = {
    headers: HEROKU_HEADERS,
    params: req.query
  }

  // Attach to our request object
  req.options = options

  // Add Access Control to Response header to avoid web request error
  // https://stackoverflow.com/questions/45975135/access-control-origin-header-error-using-axios
  res.header("Access-Control-Allow-Origin", "*");

  next()
})
// =====================================
//                GET
// =====================================

// -------------------------------------
//              PRODUCTS
// -------------------------------------

// ----- ALL PRODUCTS -----
router.get('/products', (req, res) => {

  axios.get(`${HEROKU_API_END_POINT}/products`, req.options)
    .then ((result) => {

      res.send(result.data)
    })
    .catch((err) => {
      console.log(err)
    })
})


// ----- PRODUCTS / ID -----
router.get('/products/:product_id', (req, res) => {

  axios.get(`${HEROKU_API_END_POINT}/products/${req.params.product_id}`, req.options)
    .then ((result) => {
      res.send(result.data)
    })
    .catch((err) => {
      console.log(err)
    })
})

// ----- PRODUCTS / ID / STYLES -----
router.get('/products/:product_id/styles', (req, res) => {

  axios.get(`${HEROKU_API_END_POINT}/products/${req.params.product_id}/styles`, req.options)
    .then ((result) => {
      res.send(result.data)
    })
    .catch((err) => {
      console.log(err)
    })
})

// ----- PRODUCTS / ID / RELATED-----
router.get('/products/:product_id/related', (req, res) => {

  axios.get(`${HEROKU_API_END_POINT}/products/${req.params.product_id}/related`, req.options)
    .then ((result) => {
      res.send(result.data)
    })
    .catch((err) => {
      console.log(err)
    })
})


// -------------------------------------
//              REVIEWS
// -------------------------------------


router.get('/reviews', (req, res) => {

  if (!req.query.product_id) {
    res.status(404).send('Must provide a "product_id" parameter')
  }

  const limit = Number(req.query.count) || 5;
  const offset = (Number(req.query.page) - 1) * limit || 0;

  db.query(`
    SELECT r.id, r.rating, r.summary, r.recommend, r.response, r.body, r.date, r.reviewer_name, r.helpfulness, p.id AS photo_id, p.url AS photo_url
    FROM reviews r
    LEFT JOIN reviewPhotos p ON r.id = p.review_id
    WHERE r.product_id = $1
      AND r.reported = false
    ORDER BY r.date DESC
    LIMIT $2 OFFSET $3;
    `,
    [req.query.product_id, limit, offset],
    (err, results) => {
      if (err) {
        console.error(err)
        res.sendStatus(500)
      } else {
        const reviews = results.rows.reduce((acc, row) => {
          const review = acc.find(r => r.id === row.id);
          if (!review) {
            const photos = row.photo_id ? [{ id: row.photo_id, url: row.photo_url }] : [];
            acc.push({
              id: row.id,
              rating: row.rating,
              summary: row.summary,
              recommend: row.recommend,
              response: row.response,
              body: row.body,
              date: row.date,
              reviewer_name: row.reviewer_name,
              helpfulness: row.helpfulness,
              photos: photos,
            });
          } else if (row.photo_id) {
            review.photos.push({ id: row.photo_id, url: row.photo_url });
          }
          return acc;
        }, []);
        const data = {
          product: req.query.product_id,
          page: Number(req.query.page) || 1,
          count: limit,
          results: reviews,
        };
        res.send(data);
      }
    }
  );
});

  // db.query(
  // axios.get(`${HEROKU_API_END_POINT}/reviews`, req.options)
  //   .then ((result) => {
  //     res.send(result.data)
  //   })
  //   .catch((err) => {
  //     console.log(err)
  //   })
  router.get('/reviews/meta', async (req, res) => {
    const productId = req.query.product_id

    try {
      const [ratingResult, recommendedResult, characteristicResult] = await Promise.all([
        db.query(`
          SELECT rating, count (*)
          FROM reviews
          WHERE product_id = $1
          GROUP BY rating
          ORDER BY rating ASC
        `, [productId]),


      db.query(`
        SELECT recommend, count(*)
        FROM reviews
        WHERE product_id = $1
        GROUP BY recommend
      `, [productId]),

        db.query(`
          SELECT
            c.name,
            c.id,
            AVG(value)::float AS average,
            COUNT(*) AS count
          FROM characteristics c
          JOIN characteristicReviews cr ON c.id = cr.characteristic_id
          JOIN reviews r ON cr.review_id = r.id
          WHERE r.product_id = $1
          GROUP BY c.id
        `, [productId])
      ])

      const response = {
        product_id: productId,
        ratings: {},
        recommend: {},
        characteristics: {}
      }

      ratingResult.rows.forEach((rating) => {
        response.ratings[rating.rating] = rating.count
      })

      recommendedResult.rows.forEach((recommend) => {
        response.recommend[recommend.recommend] = recommend.count
      })

      characteristicResult.rows.forEach((characteristic) => {
        response.characteristics[characteristic.name] = {
          id: characteristic.id,
          value: characteristic.average,
          count: characteristic.counts
        }
      })

      res.status(200).json(response)
    } catch (error) {
      console.error('Error in meta route:', error)
      res.status(500).send('Internal server error')
    }
  })
  //   const productId = req.query.product_id;

  //   try {
  //     const { rows: ratings } = await db.query(`
  //       SELECT rating, count(*)
  //       FROM reviews
  //       WHERE product_id = $1
  //       GROUP BY rating
  //       ORDER BY rating ASC
  //     `, [productId]);

  //     const { rows: recommended } = await db.query(`
  //       SELECT recommend, count(*)
  //       FROM reviews
  //       WHERE product_id = $1
  //       GROUP BY recommend
  //     `, [productId]);

  //     const { rows: characteristics } = await db.query(`
  //       SELECT
  //         c.name,
  //         c.id,
  //         AVG(value)::float AS average,
  //         COUNT(*) AS count
  //       FROM characteristics c
  //       JOIN characteristicReviews cr ON c.id = cr.characteristic_id
  //       JOIN reviews r ON cr.review_id = r.id
  //       WHERE r.product_id = $1
  //       GROUP BY c.id
  //     `, [productId]);

  //     const response = {
  //       product_id: productId,
  //       ratings: {},
  //       recommended: {},
  //       characteristics: {},
  //     };

  //     ratings.forEach((rating) => {
  //       response.ratings[rating.rating] = rating.count;
  //     });

  //     recommended.forEach((recommend) => {
  //       response.recommended[recommend.recommend] = recommend.count;
  //     });

  //     characteristics.forEach((characteristic) => {
  //       response.characteristics[characteristic.name] = {
  //         id: characteristic.id,
  //         value: characteristic.average,
  //         count: characteristic.count,
  //       };
  //     });

  //     res.status(200).json(response);
  //   } catch (error) {
  //     console.error('Error in /reviews/meta', error);
  //     res.status(500).send('Internal server error');
  //   }
  // });


  // if (req.options.params.product_id === undefined) {
  //   res.status(404).send('Must provide a "product_id" parameter')
  // }
  // axios.get(`${HEROKU_API_END_POINT}/reviews/meta`, req.options)
  // .then ((result) => {
  //   res.send(result.data)
  // })
  // .catch((err) => {
  //   console.log(err)
  // })

// -------------------------------------
//              Q&A
// -------------------------------------

// ----- Questions -----
router.get('/qa/questions', (req, res) => {

  if (req.options.params.product_id === undefined) {
    res.status(404).send('Must provide a "product_id" parameter')
  }

  axios.get(`${HEROKU_API_END_POINT}/qa/questions`, req.options)
    .then ((result) => {
      res.send(result.data)
    })
    .catch((err) => {
      console.log(err)
    })
})


// ----- Answers -----
router.get('/qa/questions/:question_id/answers', (req, res) => {

  if (req.params.question_id === undefined) {
    res.status(404).send('Must provide a "question_id" parameter')
  }

  axios.get(`${HEROKU_API_END_POINT}/qa/questions/${req.params.question_id}/answers`, req.options)
    .then ((result) => {
      res.send(result.data)
    })
    .catch((err) => {
      console.log(err)
    })
})

// =====================================
//                POST
// =====================================

// -------------------------------------
//              REVIEWS
// -------------------------------------

router.post('/reviews', (req, res) => {
  const { product_id, rating, summary, body, recommend, name, email, photos, characteristics } = req.body;

  if (!product_id) {
    return res.status(404).send('Must provide a "product_id" parameter');
  }

  const query = {
    text: `
    INSERT INTO reviews (product_id, rating, summary, body, recommend, reviewer_name, reviewer_email)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
    `,
    values: [product_id, rating, summary, body, recommend, name, email]
  }

  db.query(query)
    .then((result) => {
      console.log(result, '------RESULT------')
      const reviewId = result.rows[0].id
      if (photos && photos.length) {
        const photoQuery = {
          text: `
          INSERT INTO reviewPhotos (review_id, url)
          VALUES ($1, $2)
          `,
          values: photos.map((url) => [reviewId, url])
        }
        db.query(photoQuery)
      }
      const charQueries = Object.keys(characteristics).map((charId) => {
        const charQuery = {
          text: `
          INSERT INTO characteristicReviews (characteristic_id, review_id, value)
          VALUES ($1, $2, $3)
          `,
          values: [charId, reviewId, characteristics[charId]]
        }
        return db.query(charQuery)
      })
      res.status(201).send('Successfully posted review to PostgreSQL database')
    })
    .catch((err) => {
      console.error(err)
      res.status(500).send('Error connecting to PostgreSQL database')
    })
});

// router.post('/reviews', (req, res) => {
//   if (req.body.product_id === undefined) {
//     res.status(404).send('Must provide a "product_id" parameter')
//   }

//   axios.post(`${HEROKU_API_END_POINT}/reviews`, req.body, req.options)
//     .then(response => {
//       res.status(201).send('Successfully posted review to Atelier API');
//     })
//     .catch(err => {
//       console.log(err)
//       res.status(404).send('Error connecting to Atelier Reviews API');
//     })
// })

// -------------------------------------
//              Q&A
// -------------------------------------

// ----- Questions -----
router.post('/qa/questions', (req, res) => {
  if (req.body.product_id === undefined) {
    res.status(404).send('Must provide a "product_id" parameter')
  }

  axios.post(`${HEROKU_API_END_POINT}/qa/questions`, req.body, req.options)
    .then(response => {
      res.status(201).send('Successfully posted question to Atelier API');
    })
    .catch(err => {
      res.status(404).send('Error connecting to Atelier Questions API');
    })
})
// ----- Answers -----
router.post('/qa/questions/:question_id/answers', (req, res) => {
  if (req.params.question_id === undefined) {
    res.status(404).send('Must provide a "question_id" path parameter')
  }

  axios.post(`${HEROKU_API_END_POINT}/qa/questions/${req.params.question_id}/answers`, req.body, req.options)
    .then(response => {
      res.status(201).send('Successfully posted answer to Atelier API');
    })
    .catch(err => {
      res.status(404).send('Error connecting to Atelier Questions API');
    })
})

// -------------------------------------
//              INTERACTIONS
// -------------------------------------

router.post('/interactions', (req, res) => {
  if (req.body.element === undefined) {
    res.status(404).send('Must provide an "element" body parameter')
  }
  if (req.body.widget === undefined) {
    res.status(404).send('Must provide a "widget" body parameter')
  }
  if (req.body.time === undefined) {
    res.status(404).send('Must provide a "time" body parameter')
  }

  axios.post(`${HEROKU_API_END_POINT}/interactions`, req.body, req.options)
    .then(response => {
      res.status(201).send('Successfully posted interaction to Atelier API');
    })
    .catch(err => {
      res.status(404).send('Error connecting to Atelier Interactions API');
    })
})

// =====================================
//                PUT
// =====================================

// -------------------------------------
//              REVIEWS
// -------------------------------------

// ----- REVIEWS / ID / HELPFUL-----
router.put('/reviews/:review_id/helpful', async (req, res) => {
  const reviewId = req.params.review_id;
  console.log(reviewId)
  if (!reviewId) {
    res.status(404).send('Must provide a "review_id path parameter');
    return
  }
  try {
    const result = await db.query(
      `UPDATE reviews
      SET helpfulness = helpfulness + 1
      WHERE id = $1`,
      [reviewId]
    )
    if (result.rowCount === 0) {
      res.status(404).send(`Review with id ${reviewId} not found in database`)
      return
    }
    res.status(201).send('Successfully marked review as helpful')
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error')
  }
})
// ----- REVIEWS / ID / REPORT-----
router.put('/reviews/:review_id/report', (req, res) => {
  if (req.params.review_id === undefined) {
    res.status(404).send('Must provide a "review_id" path parameter')
  }

  axios.put(`${HEROKU_API_END_POINT}/reviews/${req.params.review_id}/report`, {}, req.options)
    .then(response => {
      res.status(201).send('Successfully reported review to Atelier API');
    })
    .catch(err => {
      res.status(404).send('Error connecting to Atelier Reviews API');
    })
})

// -------------------------------------
//              Q&A
// -------------------------------------

// ----- Mark Question as Helpful -----
router.put('/qa/questions/:question_id/helpful', (req, res) => {
  if (req.params.question_id === undefined) {
    res.status(404).send('Must provide a "question_id" path parameter')
  }

  axios.put(`${HEROKU_API_END_POINT}/qa/questions/${req.params.question_id}/helpful`, {}, req.options)
    .then(response => {
      res.status(201).send('Successfully marked question as helpful to Atelier API');
    })
    .catch(err => {
      res.status(404).send('Error connecting to Atelier Questions API');
    })
})
// ----- Report Question -----
router.put('/qa/questions/:question_id/report', (req, res) => {
  if (req.params.question_id === undefined) {
    res.status(404).send('Must provide a "question_id" path parameter')
  }

  axios.put(`${HEROKU_API_END_POINT}/qa/questions/${req.params.question_id}/report`, {}, req.options)
    .then(response => {
      res.status(201).send('Successfully reported question to Atelier API');
    })
    .catch(err => {
      console.log(err)
      res.status(404).send('Error connecting to Atelier Reviews API');
    })
})
// ----- Mark Answer as Helpful -----
router.put('/qa/answers/:answer_id/helpful', (req, res) => {
  if (req.params.answer_id === undefined) {
    res.status(404).send('Must provide an "answer_id" path parameter')
  }

  axios.put(`${HEROKU_API_END_POINT}/qa/answers/${req.params.answer_id}/helpful`, {}, req.options)
    .then(response => {
      res.status(201).send('Successfully marked answer as helpful to Atelier API');
    })
    .catch(err => {
      res.status(404).send('Error connecting to Atelier Questions API');
    })
})
// ----- Report Answer -----
router.put('/qa/answers/:answer_id/report', (req, res) => {
  if (req.params.answer_id === undefined) {
    res.status(404).send('Must provide an "answer_id" path parameter')
  }

  axios.put(`${HEROKU_API_END_POINT}/qa/answers/${req.params.answer_id}/report`, {}, req.options)
    .then(response => {
      res.status(201).send('Successfully reported answer to Atelier API');
    })
    .catch(err => {
      console.log(err)
      res.status(404).send('Error connecting to Atelier Reviews API');
    })
})
// // ===== POST ======
// router.post('/sessions', (req, res) => {
//   console.log('get route!')
//   res.send('get route!')
// })


// // ===== POST ======
// router.post('/purchases', userController.get)



// //TESTING.......
// router.get('/purchases/:name', userController.getOneUser)





module.exports.router = router
