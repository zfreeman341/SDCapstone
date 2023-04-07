const path = require('path');
const client = require('../database');

async function productsEtl() {
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY DEFAULT nextval('products_id_seq'),
      name VARCHAR(255),
      slogan VARCHAR(255),
      description TEXT,
      category VARCHAR(255),
      default_price NUMERIC
    )`)
    const filePath = path.join(__dirname, '../../../../../../../../../private/tmp/data/product.csv')
    await client.query(`
    COPY products(id, name, slogan, description, category, default_price)
    FROM '${filePath}'
    DELIMITER ','
    CSV HEADER
    `)
    console.log('products etl completed successfully')
  } catch (err) {
    console.error('Error in products ETL:', err)
  }
}

async function reviewsEtl() { //  INTEGER REFERENCES products(id) - for product
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS reviews (
      id serial PRIMARY KEY,
      product_id BIGINT,
      rating INT,
      date BIGINT,
      summary VARCHAR(255),
      body TEXT,
      recommend BOOLEAN,
      reported BOOLEAN,
      reviewer_name VARCHAR(255),
      reviewer_email VARCHAR(255),
      response TEXT,
      helpfulness INTEGER
    );`);

    const filePath = path.join(__dirname, '../../../../../../../../../private/tmp/data/reviews.csv')

    await client.query(`
      COPY reviews(id, product_id, rating, date, summary, body, recommend, reported, reviewer_name, reviewer_email, response, helpfulness)
      FROM '${filePath}'
      DELIMITER ','
      CSV HEADER
    `);

    console.log('Reviews ETL complete');
  } catch (err) {
    console.error('Error in reviews ETL:', err);
  }
}

async function reviewPhotosEtl() {
  try {
    await client.query(`
    CREATE TABLE IF NOT EXISTS reviewPhotos (
      id SERIAL PRIMARY KEY,
      review_id INTEGER REFERENCES reviews(id),
      url VARCHAR(255)
      )
    `)
    const filePath = path.join(__dirname, '../../../../../../../../../private/tmp/data/reviews_photos.csv')

    await client.query(`
    COPY reviewPhotos(id, review_id, url)
    FROM '${filePath}'
    DELIMITER ','
    CSV HEADER
  `);
  console.log('Data inserted into reviewPhotos table successfully')
  } catch (err) {
    console.error('Error during reviewPhotos ETL:', err)
  }
}

async function characteristicsEtl() {
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS characteristics (
      id SERIAL PRIMARY KEY,
      product_id INTEGER,
      name VARCHAR(255)
    )`)
    const filePath = path.join(__dirname, '../../../../../../../../../private/tmp/data/characteristics.csv')
      await client.query(`
      COPY characteristics(id, product_id, name)
      FROM '${filePath}'
      DELIMITER ','
      CSV HEADER
      `)
      console.log('Characteristics ETL process successfully completed')
  } catch (err) {
    console.error('Error during Characteristics ETL process', err)
  }
}

async function characteristicReviewsEtl() { //  REFERENCES characteristics(id) - potentially add to characteristic_id, circlee back
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS characteristicReviews (
      id SERIAL PRIMARY KEY,
      characteristic_id INTEGER REFERENCES characteristics(id),
      review_id INTEGER REFERENCES reviews(id),
      value INTEGER
    )`)
    const filePath = path.join(__dirname, '../../../../../../../../../private/tmp/data/characteristic_reviews.csv')

      await client.query(`
      COPY characteristicReviews(id, characteristic_id, review_id, value)
      FROM '${filePath}'
      DELIMITER ','
      CSV HEADER
      `)
    console.log('characteristicReviews ETL finished successfully!')
  } catch (err) {
    console.error('Error in characteristicReviews ETL:', err)
  }
}

async function characteristicsCountEtl() {
  await client.query(`
  SELECT product_id, characteristic_id, review_id, value
  INTO characteristicsCount
  FROM (
    SELECT * FROM characteristics c
    LEFT JOIN characteristicReviews cr
    on C.ID = CR.CHARACTERISTIC_ID
  ) as s;
  `)
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
}


async function generateReviews() {
  await productsEtl();
  console.log('products table finished')
  await reviewsEtl()
  console.log('reviews table finished')
  await reviewPhotosEtl()
  console.log('review photos table finished')
  await characteristicsEtl()
  console.log('characteristics table finished')
  await characteristicReviewsEtl()
  console.log('characteristic reviews table finished')
  await characteristicsCountEtl()
  console.log('characteristicsCountETL finished')
  client.end()
}

client.connect().then(async () => {
  await generateReviews()
  .catch(err => console.log(err))
})

module.exports = generateReviews