CREATE TABLE exchange (
    uuid UUID PRIMARY KEY DEFAULT uuid(),
    exchangeCode VARCHAR(200),
    fooDate TIMESTAMP
);
