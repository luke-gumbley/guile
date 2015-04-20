package com.atlassian.plugins.guile.rest;

import org.codehaus.jackson.annotate.JsonIgnoreProperties;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import java.sql.Timestamp;

@JsonIgnoreProperties(ignoreUnknown = true)
@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class ChangeModel {

    public ChangeModel() {}

    public ChangeModel(Timestamp date, String user, String field, String value) {
        this.date=date;
        this.user=user;
        this.field=field;
        this.value=value;
    }

    @XmlElement(name = "date")
    private Timestamp date;
    public Timestamp getDate() { return date; }
    public void setDate(Timestamp date) { this.date = date; }

    @XmlElement(name = "user")
    private String user;
    public String getUser() { return user; }
    public void setUser(String user) { this.user = user; }

    @XmlElement(name = "field")
    private String field;
    public String getField() { return field; }
    public void setField(String field) { this.field = field; }

    @XmlElement(name = "value")
    private String value;
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

}
